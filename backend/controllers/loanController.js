import { canAuthorizeLoans } from '../auth.js';
import { pool, query } from '../db.js';

const round2 = (value) => Number(Number(value).toFixed(2));

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateOnly = (date) => date.toISOString().split('T')[0];

const addMonths = (date, months) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const normalizeStatus = (status = '') => status.toString().trim().toUpperCase();

const normalizeFrequency = (value = '') => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SEMANAL' || raw === 'WEEKLY') return 'SEMANAL';
  if (raw === 'QUINCENAL' || raw === 'BIWEEKLY' || raw === 'FORTNIGHTLY') return 'QUINCENAL';
  if (raw === 'MENSUAL' || raw === 'MONTHLY') return 'MENSUAL';
  return 'MENSUAL';
};

const toDbFrequency = (normalizedFrequency, columnName) => {
  const frequency = normalizeFrequency(normalizedFrequency);
  if (columnName === 'payment_frequency') {
    if (frequency === 'SEMANAL') return 'weekly';
    if (frequency === 'QUINCENAL') return 'biweekly';
    return 'monthly';
  }
  return frequency;
};

const toDbLoanType = (rawLoanType, columnName) => {
  const normalized = String(rawLoanType || '').trim().toUpperCase();
  const mappedEs = {
    PERSONAL: 'PERSONAL',
    HIPOTECARIO: 'HIPOTECARIO',
    COMERCIAL: 'COMERCIAL',
    AUTOMOTRIZ: 'AUTOMOTRIZ',
    NEGOCIOS: 'NEGOCIOS',
    EDUCACION: 'EDUCACION',
  };
  const mappedEn = {
    PERSONAL: 'personal',
    HIPOTECARIO: 'hipotecario',
    COMERCIAL: 'negocios',
    AUTOMOTRIZ: 'automotriz',
    NEGOCIOS: 'negocios',
    EDUCACION: 'educacion',
  };
  if (columnName === 'loan_type') {
    return mappedEn[normalized] ?? String(rawLoanType || 'personal').trim().toLowerCase();
  }
  return mappedEs[normalized] ?? String(rawLoanType || 'PERSONAL').trim().toUpperCase();
};

const toDbStatus = (normalizedStatus, columnName) => {
  const raw = String(normalizedStatus || '').trim().toUpperCase();
  if (columnName === 'status') {
    if (raw === 'PENDIENTE') return 'pending';
    if (raw === 'APROBADO') return 'approved';
    if (raw === 'RECHAZADO') return 'rejected';
    return 'pending';
  }
  if (raw === 'APROBADO' || raw === 'RECHAZADO' || raw === 'PENDIENTE') return raw;
  return 'PENDIENTE';
};

const getFrequencyConfig = (frequency = 'MENSUAL') => {
  const normalized = normalizeFrequency(frequency);
  switch (normalized) {
    case 'SEMANAL':
      return {
        normalized,
        installmentsPerMonth: 4,
        rateDivisor: 4,
        addPeriod: (date, installments) => addDays(date, installments * 7),
      };
    case 'QUINCENAL':
      return {
        normalized,
        installmentsPerMonth: 2,
        rateDivisor: 2,
        addPeriod: (date, installments) => addDays(date, installments * 15),
      };
    default:
      return {
        normalized: 'MENSUAL',
        installmentsPerMonth: 1,
        rateDivisor: 1,
        addPeriod: (date, installments) => addMonths(date, installments),
      };
  }
};

const PARAMETER_CODES = {
  lifeInsurance: ['SEGURO_VIDA_PCT', 'CREDITO_SEGURO_VIDA_PCT'],
  damageInsurance: ['SEGURO_DANOS_PCT', 'CREDITO_SEGURO_DANOS_PCT'],
  commission: ['COMISION_CREDITO_PCT', 'CREDITO_COMISION_PCT'],
};

const parseParameterValue = (rawValue, fallback = 0) => {
  if (rawValue === null || rawValue === undefined) {
    return fallback;
  }
  const normalized = String(rawValue).trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getFinancialParameters = async () => {
  const codes = [
    ...PARAMETER_CODES.lifeInsurance,
    ...PARAMETER_CODES.damageInsurance,
    ...PARAMETER_CODES.commission,
  ];
  let result;
  try {
    result = await query(
      `SELECT codigo, valor
       FROM pa.parametros
       WHERE activo = true
         AND codigo = ANY($1::text[])`,
      [codes],
    );
  } catch (error) {
    return {
      seguroVidaPct: 0,
      seguroDanosPct: 0,
      comisionPct: 0,
    };
  }

  const asMap = new Map(result.rows.map((row) => [row.codigo, row.valor]));

  const pick = (options, fallback) => {
    for (const code of options) {
      if (asMap.has(code)) {
        return parseParameterValue(asMap.get(code), fallback);
      }
    }
    return fallback;
  };

  return {
    seguroVidaPct: pick(PARAMETER_CODES.lifeInsurance, 0),
    seguroDanosPct: pick(PARAMETER_CODES.damageInsurance, 0),
    comisionPct: pick(PARAMETER_CODES.commission, 0),
  };
};

const buildFrenchAmortization = ({
  principal,
  annualRatePct,
  termMonths,
  frequency,
  firstDueDate,
  seguroVidaPct,
  seguroDanosPct,
}) => {
  const frequencyConfig = getFrequencyConfig(frequency);
  const totalInstallments = Math.max(1, Math.round(termMonths * frequencyConfig.installmentsPerMonth));
  const monthlyRate = annualRatePct / 100;
  const periodicRate = monthlyRate / frequencyConfig.rateDivisor;
  const periodicSeguroVidaRate = (seguroVidaPct / 100) / frequencyConfig.rateDivisor;
  const periodicSeguroDanosRate = (seguroDanosPct / 100) / frequencyConfig.rateDivisor;
  const rows = [];
  let balance = round2(principal);

  let baseInstallment = 0;
  if (totalInstallments > 0) {
    if (periodicRate === 0) {
      baseInstallment = principal / totalInstallments;
    } else {
      const factor = Math.pow(1 + periodicRate, totalInstallments);
      baseInstallment = (principal * periodicRate * factor) / (factor - 1);
    }
  }

  for (let installment = 1; installment <= totalInstallments; installment += 1) {
    const isLast = installment === totalInstallments;
    const interest = round2(balance * periodicRate);
    const capital = isLast ? balance : round2(baseInstallment - interest);
    const lifeInsurance = round2(balance * periodicSeguroVidaRate);
    const damageInsurance = round2(balance * periodicSeguroDanosRate);
    const payment = round2(capital + interest + lifeInsurance + damageInsurance);

    balance = isLast ? 0 : round2(Math.max(0, balance - capital));

    rows.push({
      numeroCuota: installment,
      fechaVencimiento: toDateOnly(frequencyConfig.addPeriod(firstDueDate, installment - 1)),
      capital,
      interes: interest,
      seguroVida: lifeInsurance,
      seguroDanos: damageInsurance,
      cuotaTotal: payment,
      saldoCapital: balance,
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.capital += row.capital;
      acc.interes += row.interes;
      acc.seguroVida += row.seguroVida;
      acc.seguroDanos += row.seguroDanos;
      acc.cuota += row.cuotaTotal;
      return acc;
    },
    { capital: 0, interes: 0, seguroVida: 0, seguroDanos: 0, cuota: 0 },
  );

  return {
    rows,
    firstInstallmentAmount: rows[0]?.cuotaTotal ?? 0,
    totals: {
      totalCapital: round2(totals.capital),
      totalInteres: round2(totals.interes),
      totalSeguroVida: round2(totals.seguroVida),
      totalSeguroDanos: round2(totals.seguroDanos),
      totalCuotas: round2(totals.cuota),
    },
  };
};

const generateCreditCode = async (dbClient) => {
  const nextIdResult = await dbClient.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM op.creditos');
  const nextId = nextIdResult.rows[0].next_id;
  const now = new Date();
  const year = now.getFullYear();
  return `CR-${year}-${String(nextId).padStart(6, '0')}`;
};

const columnsCache = new Map();

const getTableColumns = async (dbClient, schema, table) => {
  const cacheKey = `${schema}.${table}`;
  if (columnsCache.has(cacheKey)) {
    return columnsCache.get(cacheKey);
  }

  const result = await dbClient.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, table],
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  columnsCache.set(cacheKey, columns);
  return columns;
};

const pickExistingColumn = (columns, candidates) => {
  for (const candidate of candidates) {
    if (columns.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

const buildInsertQuery = (schema, table, payload) => {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const sql = `INSERT INTO ${schema}.${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  return { sql, values };
};

const safeParseJson = (value, fallback = {}) => {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const buildRejectedObservations = (currentValue, rejectionReason) => {
  const trimmedReason = String(rejectionReason || 'Solicitud rechazada').trim();
  const timestamp = new Date().toISOString();
  const parsed = safeParseJson(currentValue, null);

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const previousHistory = Array.isArray(parsed.rejectionHistory) ? parsed.rejectionHistory : [];
    return JSON.stringify({
      ...parsed,
      rejectionReason: trimmedReason,
      rejectedAt: timestamp,
      rejectionHistory: [
        ...previousHistory,
        {
          reason: trimmedReason,
          createdAt: timestamp,
        },
      ],
    });
  }

  const baseText = String(currentValue || '').trim();
  return baseText
    ? `${baseText}\nRECHAZO: ${trimmedReason}`
    : `RECHAZO: ${trimmedReason}`;
};

const parseInteger = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const isPaidInstallmentStatus = (status) => {
  const currentStatus = normalizeStatus(status);
  return currentStatus === 'PAGADO'
    || currentStatus === 'PAID'
    || currentStatus === 'CANCELADA'
    || currentStatus === 'CANCELADO';
};

const resolveOrCreateClientId = async (dbClient, userId, body = {}) => {
  const rawClientId = parseInteger(body.cliente_id ?? body.clientId);
  const clientsColumns = await getTableColumns(dbClient, 'cl', 'clientes');
  const clientsMap = {
    id: pickExistingColumn(clientsColumns, ['id']),
    identificacion: pickExistingColumn(clientsColumns, ['identificacion', 'dpi']),
    tipoIdentificacion: pickExistingColumn(clientsColumns, ['tipo_identificacion']),
    nombres: pickExistingColumn(clientsColumns, ['nombres', 'first_name']),
    apellidos: pickExistingColumn(clientsColumns, ['apellidos', 'last_name']),
    telefono: pickExistingColumn(clientsColumns, ['telefono', 'phone']),
    email: pickExistingColumn(clientsColumns, ['email']),
    direccion: pickExistingColumn(clientsColumns, ['direccion', 'address']),
    ocupacion: pickExistingColumn(clientsColumns, ['ocupacion', 'employment_status']),
    ingresoMensual: pickExistingColumn(clientsColumns, ['ingreso_mensual', 'monthly_income']),
    estadoCivil: pickExistingColumn(clientsColumns, ['estado_civil']),
    asesorId: pickExistingColumn(clientsColumns, ['asesor_id', 'created_by']),
    activo: pickExistingColumn(clientsColumns, ['activo', 'is_active']),
  };

  if (rawClientId && rawClientId > 0) {
    const whereActive = clientsMap.activo ? ` AND ${clientsMap.activo} = true` : '';
    const result = await dbClient.query(
      `SELECT ${clientsMap.id ?? 'id'} AS id
       FROM cl.clientes
       WHERE ${clientsMap.id ?? 'id'} = $1${whereActive}
       LIMIT 1`,
      [rawClientId],
    );
    if (result.rowCount > 0) {
      return Number(result.rows[0].id);
    }
  }

  const incomingClient = body.cliente ?? {};
  const fivesaProfile = {
    direccion: incomingClient.direccion ?? incomingClient.address ?? null,
    telefono_1: incomingClient.telefono_1 ?? incomingClient.telefono ?? incomingClient.phone ?? null,
    telefono_2: incomingClient.telefono_2 ?? null,
    actividad_economica: incomingClient.actividad_economica ?? incomingClient.ocupacion ?? null,
    lugar_trabajo: incomingClient.lugar_trabajo ?? null,
    antiguedad_laboral: incomingClient.antiguedad_laboral ?? null,
    salario_bruto: parseNumber(incomingClient.salario_bruto ?? incomingClient.ingreso_mensual ?? incomingClient.monthly_income, null),
    inss: parseNumber(incomingClient.inss, null),
    ir: parseNumber(incomingClient.ir, null),
    egreso_alquiler: parseNumber(incomingClient.egreso_alquiler, null),
    egreso_servicios: parseNumber(incomingClient.egreso_servicios, null),
    egreso_alimentacion: parseNumber(incomingClient.egreso_alimentacion, null),
    garantia_descripcion: incomingClient.garantia_descripcion ?? null,
    referencia_1_nombre: incomingClient.referencia_1_nombre ?? null,
    referencia_1_telefono: incomingClient.referencia_1_telefono ?? null,
    referencia_2_nombre: incomingClient.referencia_2_nombre ?? null,
    referencia_2_telefono: incomingClient.referencia_2_telefono ?? null,
  };
  const identificacion = incomingClient.identificacion ?? incomingClient.dpi ?? null;
  const nombres = incomingClient.nombres ?? incomingClient.first_name ?? null;
  const apellidos = incomingClient.apellidos ?? incomingClient.last_name ?? null;
  const email = incomingClient.email ?? null;

  if (!identificacion || !nombres || !apellidos) {
    return null;
  }

  if (clientsMap.identificacion) {
    const byIdentification = await dbClient.query(
      `SELECT ${clientsMap.id ?? 'id'} AS id
       FROM cl.clientes
       WHERE ${clientsMap.identificacion} = $1
       LIMIT 1`,
      [identificacion],
    );
    if (byIdentification.rowCount > 0) {
      return Number(byIdentification.rows[0].id);
    }
  }

  if (email && clientsMap.email) {
    const byEmail = await dbClient.query(
      `SELECT ${clientsMap.id ?? 'id'} AS id
       FROM cl.clientes
       WHERE ${clientsMap.email} = $1
       LIMIT 1`,
      [email],
    );
    if (byEmail.rowCount > 0) {
      return Number(byEmail.rows[0].id);
    }
  }

  const clientPayload = {};
  if (clientsMap.identificacion) clientPayload[clientsMap.identificacion] = identificacion;
  if (clientsMap.tipoIdentificacion) clientPayload[clientsMap.tipoIdentificacion] = incomingClient.tipo_identificacion ?? 'DNI';
  if (clientsMap.nombres) clientPayload[clientsMap.nombres] = nombres;
  if (clientsMap.apellidos) clientPayload[clientsMap.apellidos] = apellidos;
  if (clientsMap.telefono) clientPayload[clientsMap.telefono] = incomingClient.telefono ?? incomingClient.phone ?? null;
  if (clientsMap.email) clientPayload[clientsMap.email] = email;
  if (clientsMap.direccion) clientPayload[clientsMap.direccion] = fivesaProfile.direccion;
  if (clientsMap.ocupacion) clientPayload[clientsMap.ocupacion] = fivesaProfile.actividad_economica ?? incomingClient.employment_status ?? null;
  if (clientsMap.ingresoMensual) clientPayload[clientsMap.ingresoMensual] = fivesaProfile.salario_bruto;
  if (clientsMap.estadoCivil) clientPayload[clientsMap.estadoCivil] = JSON.stringify({ fivesa_profile: fivesaProfile });
  if (clientsMap.asesorId) clientPayload[clientsMap.asesorId] = userId;
  if (clientsMap.activo) clientPayload[clientsMap.activo] = true;

  const requiredClientColumns = [clientsMap.identificacion, clientsMap.nombres, clientsMap.apellidos];
  if (requiredClientColumns.some((column) => !column)) {
    throw new Error('La tabla cl.clientes no tiene columnas suficientes para crear cliente');
  }

  const { sql, values } = buildInsertQuery('cl', 'clientes', clientPayload);
  const insertResult = await dbClient.query(
    `${sql} RETURNING ${clientsMap.id ?? 'id'} AS id`,
    values,
  );

  if (insertResult.rowCount === 0) {
    return null;
  }

  return Number(insertResult.rows[0].id);
};

export const calculateLoan = async (req, res) => {
  try {
    const principal = parseNumber(req.body.amount ?? req.body.monto_solicitado, 0);
    const termMonths = parseInt(req.body.termMonths ?? req.body.plazo_meses, 10);
    const annualRatePct = parseNumber(req.body.annualRate ?? req.body.tasa_interes, 0);
    const frequency = normalizeFrequency(req.body.frecuencia ?? req.body.frequency);
    const firstDueDate = req.body.firstDueDate
      ? new Date(req.body.firstDueDate)
      : addMonths(new Date(), 1);

    if (principal <= 0 || !Number.isInteger(termMonths) || termMonths <= 0 || annualRatePct < 0) {
      return res.status(400).json({
        success: false,
        message: 'Datos invalidos para simulacion',
      });
    }

    const parameters = await getFinancialParameters();

    const seguroVidaPct = parseNumber(req.body.seguroVidaPct, parameters.seguroVidaPct);
    const seguroDanosPct = parseNumber(req.body.seguroDanosPct, parameters.seguroDanosPct);
    const comisionPct = parseNumber(req.body.comisionPct, parameters.comisionPct);

    const amortization = buildFrenchAmortization({
      principal,
      annualRatePct,
      termMonths,
      frequency,
      firstDueDate,
      seguroVidaPct,
      seguroDanosPct,
    });

    const totalComision = round2(principal * (comisionPct / 100));

    res.json({
      success: true,
      calculation: {
        montoSolicitado: round2(principal),
        tasaInteresAnual: round2(annualRatePct),
        plazoMeses: termMonths,
        frecuencia: frequency,
        numeroCuotas: amortization.rows.length,
        cuotaReferencial: amortization.firstInstallmentAmount,
        totalComision,
        ...amortization.totals,
      },
      rates: {
        seguroVidaPct: round2(seguroVidaPct),
        seguroDanosPct: round2(seguroDanosPct),
        comisionPct: round2(comisionPct),
      },
      amortization: amortization.rows,
    });
  } catch (error) {
    console.error('Error calculando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el calculo del credito',
    });
  }
};

export const createLoan = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const userId = req.userId;
    const requestedClientId = parseInteger(req.body.cliente_id ?? req.body.clientId);
    const montoSolicitado = parseNumber(req.body.monto_solicitado ?? req.body.amountRequested, 0);
    const tasaInteres = parseNumber(req.body.tasa_interes ?? req.body.annualInterestRate, 0);
    const plazoMeses = parseInt(req.body.plazo_meses ?? req.body.termMonths, 10);
    const frecuencia = normalizeFrequency(req.body.frecuencia ?? req.body.frequency);
    const tipoCredito = req.body.tipo_credito ?? req.body.loanType ?? 'PERSONAL';
    const destino = req.body.destino ?? req.body.purpose ?? null;
    const observacionesEntrada = req.body.observaciones ?? null;
    const firstDueDate = req.body.firstDueDate
      ? new Date(req.body.firstDueDate)
      : addMonths(new Date(), 1);

    if (montoSolicitado <= 0 || tasaInteres < 0 || !Number.isInteger(plazoMeses) || plazoMeses <= 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Datos del credito invalidos',
        fieldErrors: {
          ...(montoSolicitado > 0 ? {} : { monto_solicitado: 'El monto debe ser mayor que 0' }),
          ...(tasaInteres >= 0 ? {} : { tasa_interes: 'La tasa no puede ser negativa' }),
          ...(Number.isInteger(plazoMeses) && plazoMeses > 0 ? {} : { plazo_meses: 'El plazo debe ser mayor que 0' }),
        },
      });
    }

    const clienteId = await resolveOrCreateClientId(dbClient, userId, req.body);
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      await dbClient.query('ROLLBACK');
      return res.status(requestedClientId ? 404 : 400).json({
        success: false,
        code: requestedClientId ? 'CLIENT_NOT_FOUND' : 'VALIDATION_ERROR',
        message: requestedClientId
          ? 'Cliente no encontrado'
          : 'No fue posible vincular la solicitud con un cliente valido',
      });
    }

    const parameters = await getFinancialParameters();
    const seguroVidaPct = parseNumber(req.body.seguroVidaPct, parameters.seguroVidaPct);
    const seguroDanosPct = parseNumber(req.body.seguroDanosPct, parameters.seguroDanosPct);
    const comisionPct = parseNumber(req.body.comisionPct, parameters.comisionPct);

    const amortization = buildFrenchAmortization({
      principal: montoSolicitado,
      annualRatePct: tasaInteres,
      termMonths: plazoMeses,
      frequency: frecuencia,
      firstDueDate,
      seguroVidaPct,
      seguroDanosPct,
    });

    const totalComision = round2(montoSolicitado * (comisionPct / 100));
    const metadata = {
      seguroVidaPct: round2(seguroVidaPct),
      seguroDanosPct: round2(seguroDanosPct),
      comisionPct: round2(comisionPct),
      frecuencia,
      totalComision,
    };
    const observaciones = JSON.stringify({
      nota: observacionesEntrada,
      calculo: metadata,
      perfil: req.body.perfil ?? null,
      analisis: req.body.analisis ?? null,
      garantias: req.body.garantias ?? [],
      referencias: req.body.referencias ?? [],
      cliente: req.body.cliente ?? null,
    });

    const codigo = await generateCreditCode(dbClient);
    const creditColumns = await getTableColumns(dbClient, 'op', 'creditos');

    const creditColumnMap = {
      id: pickExistingColumn(creditColumns, ['id']),
      codigo: pickExistingColumn(creditColumns, ['codigo', 'numero_credito']),
      clienteId: pickExistingColumn(creditColumns, ['cliente_id', 'client_id']),
      montoSolicitado: pickExistingColumn(creditColumns, ['monto_solicitado', 'amount_requested', 'monto']),
      tasaInteres: pickExistingColumn(creditColumns, ['tasa_interes', 'annual_interest_rate']),
      plazoMeses: pickExistingColumn(creditColumns, ['plazo_meses', 'term_months']),
      tipoCredito: pickExistingColumn(creditColumns, ['tipo_credito', 'loan_type']),
      frecuenciaPago: pickExistingColumn(creditColumns, ['frecuencia_pago', 'payment_frequency']),
      destino: pickExistingColumn(creditColumns, ['destino', 'purpose']),
      estado: pickExistingColumn(creditColumns, ['estado', 'status']),
      observaciones: pickExistingColumn(creditColumns, ['observaciones', 'notes']),
      asesorId: pickExistingColumn(creditColumns, ['asesor_id', 'created_by', 'usuario_id']),
      fechaSolicitud: pickExistingColumn(creditColumns, ['fecha_solicitud', 'created_at']),
      cuotaReferencial: pickExistingColumn(creditColumns, ['cuota_referencial', 'monthly_payment']),
      comisionTotal: pickExistingColumn(creditColumns, ['comision_total', 'total_comision', 'commission_amount']),
      seguroVidaPct: pickExistingColumn(creditColumns, ['seguro_vida_pct']),
      seguroDanosPct: pickExistingColumn(creditColumns, ['seguro_danos_pct', 'seguro_danios_pct']),
      comisionPct: pickExistingColumn(creditColumns, ['comision_pct', 'commission_pct']),
      fechaPrimerVencimiento: pickExistingColumn(creditColumns, ['fecha_primer_vencimiento']),
    };

    const requiredCreditColumns = [
      creditColumnMap.clienteId,
      creditColumnMap.montoSolicitado,
      creditColumnMap.tasaInteres,
      creditColumnMap.plazoMeses,
      creditColumnMap.tipoCredito,
    ];

    if (requiredCreditColumns.some((column) => !column)) {
      throw new Error('La tabla op.creditos no tiene las columnas minimas requeridas para registrar el credito');
    }

    const creditPayload = {
      [creditColumnMap.clienteId]: clienteId,
      [creditColumnMap.montoSolicitado]: montoSolicitado,
      [creditColumnMap.tasaInteres]: tasaInteres,
      [creditColumnMap.plazoMeses]: plazoMeses,
      [creditColumnMap.tipoCredito]: toDbLoanType(tipoCredito, creditColumnMap.tipoCredito),
    };

    if (creditColumnMap.codigo) creditPayload[creditColumnMap.codigo] = codigo;
    if (creditColumnMap.destino) creditPayload[creditColumnMap.destino] = destino;
    if (creditColumnMap.frecuenciaPago) {
      creditPayload[creditColumnMap.frecuenciaPago] = toDbFrequency(
        frecuencia,
        creditColumnMap.frecuenciaPago,
      );
    }
    if (creditColumnMap.estado) {
      creditPayload[creditColumnMap.estado] = toDbStatus('PENDIENTE', creditColumnMap.estado);
    }
    if (creditColumnMap.observaciones) creditPayload[creditColumnMap.observaciones] = observaciones;
    if (creditColumnMap.asesorId) creditPayload[creditColumnMap.asesorId] = userId;
    if (creditColumnMap.cuotaReferencial) creditPayload[creditColumnMap.cuotaReferencial] = amortization.firstInstallmentAmount;
    if (creditColumnMap.comisionTotal) creditPayload[creditColumnMap.comisionTotal] = totalComision;
    if (creditColumnMap.seguroVidaPct) creditPayload[creditColumnMap.seguroVidaPct] = metadata.seguroVidaPct;
    if (creditColumnMap.seguroDanosPct) creditPayload[creditColumnMap.seguroDanosPct] = metadata.seguroDanosPct;
    if (creditColumnMap.comisionPct) creditPayload[creditColumnMap.comisionPct] = metadata.comisionPct;
    if (creditColumnMap.fechaPrimerVencimiento) {
      creditPayload[creditColumnMap.fechaPrimerVencimiento] = toDateOnly(firstDueDate);
    }

    const { sql: creditSql, values: creditValues } = buildInsertQuery('op', 'creditos', creditPayload);
    const returningColumns = [
      creditColumnMap.id,
      creditColumnMap.codigo,
      creditColumnMap.fechaSolicitud,
      creditColumnMap.estado,
    ].filter(Boolean);
    const creditResult = await dbClient.query(
      `${creditSql} RETURNING ${returningColumns.length > 0 ? returningColumns.join(', ') : '*'}`,
      creditValues,
    );

    const creditRow = creditResult.rows[0];
    const creditoId = Number(creditRow[creditColumnMap.id ?? 'id']);
    if (!Number.isFinite(creditoId)) {
      throw new Error('No se pudo obtener el ID del credito creado');
    }

    await dbClient.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Solicitud de credito creada correctamente',
      loan: {
        id: creditoId,
        codigo: creditRow[creditColumnMap.codigo ?? 'codigo'] ?? codigo,
        cliente_id: clienteId,
        monto_solicitado: round2(montoSolicitado),
        tasa_interes: round2(tasaInteres),
        plazo_meses: plazoMeses,
        frecuencia,
        estado: creditRow[creditColumnMap.estado ?? 'estado'] ?? 'PENDIENTE',
        fecha_solicitud: creditRow[creditColumnMap.fechaSolicitud ?? 'fecha_solicitud'] ?? null,
      },
      calculation: {
        cuotaReferencial: amortization.firstInstallmentAmount,
        ...amortization.totals,
        totalComision,
      },
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}

    if (error?.code === '23505') {
      const detail = String(error?.detail ?? '').toLowerCase();
      const isEmail = detail.includes('email');
      const isIdentification = detail.includes('identificacion');
      return res.status(400).json({
        success: false,
        code: isEmail ? 'DUPLICATE_EMAIL' : isIdentification ? 'DUPLICATE_IDENTIFICACION' : 'INTEGRITY_ERROR',
        message: isEmail
          ? 'El correo ya existe'
          : isIdentification
            ? 'La cedula ya existe'
            : 'No se pudo completar la operacion por restriccion de integridad',
        fieldErrors: {
          ...(isEmail ? { 'cliente.email': 'El correo ya existe' } : {}),
          ...(isIdentification ? { 'cliente.identificacion': 'La cedula ya existe' } : {}),
        },
      });
    }

    if (error?.code === '23514') {
      const detail = String(error?.detail ?? '').toLowerCase();
      const isFrequency = detail.includes('payment_frequency') || detail.includes('frecuencia');
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: isFrequency
          ? 'La frecuencia de pago no es valida para la configuracion actual'
          : 'Los datos enviados no cumplen una validacion de integridad',
        fieldErrors: isFrequency ? { frecuencia: 'Frecuencia invalida' } : {},
      });
    }

    if (error?.code === '23502') {
      const column = error?.column ? String(error.column) : null;
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Faltan campos obligatorios para registrar la solicitud',
        fieldErrors: column ? { [column]: `El campo ${column} es obligatorio` } : {},
      });
    }

    if (error?.message?.includes('columnas')) {
      console.error('Error de esquema creando credito:', error);
      return res.status(500).json({
        success: false,
        code: 'INTEGRITY_ERROR',
        message: 'Error interno al registrar la solicitud de credito',
      });
    }

    console.error('Error creando credito:', error);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Error creando la solicitud de credito',
    });
  } finally {
    dbClient.release();
  }
};

export const approveLoan = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    if (!canAuthorizeLoans(req.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para aprobar creditos' });
    }

    const creditId = parseInt(req.params.id, 10);
    const userId = req.userId;
    if (!Number.isInteger(creditId) || creditId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de credito invalido' });
    }

    await dbClient.query('BEGIN');

    const creditColumns = await getTableColumns(dbClient, 'op', 'creditos');
    const creditColumnMap = {
      id: pickExistingColumn(creditColumns, ['id']),
      codigo: pickExistingColumn(creditColumns, ['codigo', 'numero_credito']),
      clienteId: pickExistingColumn(creditColumns, ['cliente_id', 'client_id']),
      montoSolicitado: pickExistingColumn(creditColumns, ['monto_solicitado', 'amount_requested', 'monto']),
      tasaInteres: pickExistingColumn(creditColumns, ['tasa_interes', 'annual_interest_rate']),
      plazoMeses: pickExistingColumn(creditColumns, ['plazo_meses', 'term_months']),
      frecuenciaPago: pickExistingColumn(creditColumns, ['frecuencia_pago', 'payment_frequency']),
      estado: pickExistingColumn(creditColumns, ['estado', 'status']),
      aprobadoPor: pickExistingColumn(creditColumns, ['aprobado_por', 'approved_by']),
      fechaAprobacion: pickExistingColumn(creditColumns, ['fecha_aprobacion', 'approval_date']),
      fechaPrimerVencimiento: pickExistingColumn(creditColumns, ['fecha_primer_vencimiento']),
      observaciones: pickExistingColumn(creditColumns, ['observaciones', 'notes']),
      seguroVidaPct: pickExistingColumn(creditColumns, ['seguro_vida_pct']),
      seguroDanosPct: pickExistingColumn(creditColumns, ['seguro_danos_pct', 'seguro_danios_pct']),
      comisionPct: pickExistingColumn(creditColumns, ['comision_pct', 'commission_pct']),
    };
    const requiredCreditColumns = [
      creditColumnMap.id,
      creditColumnMap.montoSolicitado,
      creditColumnMap.tasaInteres,
      creditColumnMap.plazoMeses,
      creditColumnMap.estado,
    ];
    if (requiredCreditColumns.some((column) => !column)) {
      throw new Error('La tabla op.creditos no tiene columnas minimas para aprobar');
    }

    const selectList = [
      `${creditColumnMap.id} AS id`,
      `${creditColumnMap.montoSolicitado} AS monto_solicitado`,
      `${creditColumnMap.tasaInteres} AS tasa_interes`,
      `${creditColumnMap.plazoMeses} AS plazo_meses`,
      `${creditColumnMap.estado} AS estado`,
      creditColumnMap.codigo ? `${creditColumnMap.codigo} AS codigo` : `NULL AS codigo`,
      creditColumnMap.clienteId ? `${creditColumnMap.clienteId} AS cliente_id` : `NULL AS cliente_id`,
      creditColumnMap.fechaPrimerVencimiento
        ? `${creditColumnMap.fechaPrimerVencimiento} AS fecha_primer_vencimiento`
        : `NULL AS fecha_primer_vencimiento`,
      creditColumnMap.observaciones ? `${creditColumnMap.observaciones} AS observaciones` : `NULL AS observaciones`,
      creditColumnMap.frecuenciaPago ? `${creditColumnMap.frecuenciaPago} AS frecuencia_pago` : `NULL AS frecuencia_pago`,
      creditColumnMap.seguroVidaPct ? `${creditColumnMap.seguroVidaPct} AS seguro_vida_pct` : `NULL AS seguro_vida_pct`,
      creditColumnMap.seguroDanosPct ? `${creditColumnMap.seguroDanosPct} AS seguro_danos_pct` : `NULL AS seguro_danos_pct`,
      creditColumnMap.comisionPct ? `${creditColumnMap.comisionPct} AS comision_pct` : `NULL AS comision_pct`,
    ].join(', ');

    const creditResult = await dbClient.query(
      `SELECT ${selectList}
       FROM op.creditos
       WHERE ${creditColumnMap.id} = $1
         AND ${creditColumnMap.estado} = 'PENDIENTE'
       FOR UPDATE`,
      [creditId],
    );
    if (creditResult.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Credito no encontrado o no esta pendiente' });
    }

    const credit = creditResult.rows[0];
    const parsedObservaciones = safeParseJson(credit.observaciones, {});
    const parsedCalculo = parsedObservaciones.calculo ?? {};
    const frecuencia = normalizeFrequency(credit.frecuencia_pago ?? parsedCalculo.frecuencia ?? 'MENSUAL');

    const parameters = await getFinancialParameters();
    const seguroVidaPct = parseNumber(credit.seguro_vida_pct ?? parsedCalculo.seguroVidaPct, parameters.seguroVidaPct);
    const seguroDanosPct = parseNumber(credit.seguro_danos_pct ?? parsedCalculo.seguroDanosPct, parameters.seguroDanosPct);
    const comisionPct = parseNumber(credit.comision_pct ?? parsedCalculo.comisionPct, parameters.comisionPct);
    const firstDueDate = credit.fecha_primer_vencimiento ? new Date(credit.fecha_primer_vencimiento) : addMonths(new Date(), 1);

    const amortization = buildFrenchAmortization({
      principal: parseNumber(credit.monto_solicitado),
      annualRatePct: parseNumber(credit.tasa_interes),
      termMonths: parseInt(credit.plazo_meses, 10),
      frequency: frecuencia,
      firstDueDate,
      seguroVidaPct,
      seguroDanosPct,
    });

    const amortizationColumns = await getTableColumns(dbClient, 'op', 'amortizaciones');
    const amortizationColumnMap = {
      creditoId: pickExistingColumn(amortizationColumns, ['credito_id', 'loan_id']),
      numeroCuota: pickExistingColumn(amortizationColumns, ['numero_cuota', 'payment_number']),
      fechaVencimiento: pickExistingColumn(amortizationColumns, ['fecha_vencimiento', 'due_date']),
      capital: pickExistingColumn(amortizationColumns, ['capital', 'principal_amount']),
      interes: pickExistingColumn(amortizationColumns, ['interes', 'interest_amount']),
      cuotaTotal: pickExistingColumn(amortizationColumns, ['cuota_total', 'total_amount']),
      saldoCapital: pickExistingColumn(amortizationColumns, ['saldo_capital', 'balance_after_payment']),
      estado: pickExistingColumn(amortizationColumns, ['estado', 'status']),
      seguroVida: pickExistingColumn(amortizationColumns, ['seguro_vida', 'monto_seguro_vida']),
      seguroDanos: pickExistingColumn(amortizationColumns, ['seguro_danos', 'seguro_danios', 'monto_seguro_danos', 'monto_seguro_danios']),
    };
    const requiredAmortizationColumns = [
      amortizationColumnMap.creditoId,
      amortizationColumnMap.numeroCuota,
      amortizationColumnMap.fechaVencimiento,
      amortizationColumnMap.capital,
      amortizationColumnMap.interes,
      amortizationColumnMap.cuotaTotal,
      amortizationColumnMap.saldoCapital,
    ];
    if (requiredAmortizationColumns.some((column) => !column)) {
      throw new Error('La tabla op.amortizaciones no tiene columnas minimas para generar plan');
    }

    await dbClient.query(`DELETE FROM op.amortizaciones WHERE ${amortizationColumnMap.creditoId} = $1`, [creditId]);

    for (const row of amortization.rows) {
      const amortizationPayload = {
        [amortizationColumnMap.creditoId]: creditId,
        [amortizationColumnMap.numeroCuota]: row.numeroCuota,
        [amortizationColumnMap.fechaVencimiento]: row.fechaVencimiento,
        [amortizationColumnMap.capital]: row.capital,
        [amortizationColumnMap.interes]: row.interes,
        [amortizationColumnMap.cuotaTotal]: row.cuotaTotal,
        [amortizationColumnMap.saldoCapital]: row.saldoCapital,
      };
      if (amortizationColumnMap.estado) amortizationPayload[amortizationColumnMap.estado] = 'PENDIENTE';
      if (amortizationColumnMap.seguroVida) amortizationPayload[amortizationColumnMap.seguroVida] = row.seguroVida;
      if (amortizationColumnMap.seguroDanos) amortizationPayload[amortizationColumnMap.seguroDanos] = row.seguroDanos;
      const { sql, values } = buildInsertQuery('op', 'amortizaciones', amortizationPayload);
      await dbClient.query(sql, values);
    }

    const updateParts = [`${creditColumnMap.estado} = 'APROBADO'`];
    const updateValues = [];
    if (creditColumnMap.aprobadoPor) {
      updateValues.push(userId);
      updateParts.push(`${creditColumnMap.aprobadoPor} = $${updateValues.length}`);
    }
    if (creditColumnMap.fechaAprobacion) {
      updateParts.push(`${creditColumnMap.fechaAprobacion} = NOW()`);
    }
    updateValues.push(creditId);
    const whereParam = updateValues.length;

    const updatedLoanResult = await dbClient.query(
      `UPDATE op.creditos
       SET ${updateParts.join(', ')}
       WHERE ${creditColumnMap.id} = $${whereParam}
       RETURNING ${creditColumnMap.id} AS id,
                 ${creditColumnMap.codigo ? `${creditColumnMap.codigo} AS codigo,` : `'N/A' AS codigo,`}
                 ${creditColumnMap.clienteId ? `${creditColumnMap.clienteId} AS cliente_id,` : `NULL AS cliente_id,`}
                 ${creditColumnMap.estado} AS estado
                 ${creditColumnMap.fechaAprobacion ? `, ${creditColumnMap.fechaAprobacion} AS fecha_aprobacion` : ''}`,
      updateValues,
    );

    await dbClient.query('COMMIT');

    res.json({
      success: true,
      message: 'Credito aprobado correctamente',
      loan: updatedLoanResult.rows[0],
      calculation: {
        cuotaReferencial: amortization.firstInstallmentAmount,
        ...amortization.totals,
        totalComision: round2(parseNumber(credit.monto_solicitado) * (comisionPct / 100)),
      },
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}
    console.error('Error aprobando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error aprobando credito',
    });
  } finally {
    dbClient.release();
  }
};

export const rejectLoan = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    if (!canAuthorizeLoans(req.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para rechazar creditos' });
    }

    const creditId = parseInt(req.params.id, 10);
    const rejectionReason = req.body.rejectionReason ?? req.body.observaciones ?? 'Solicitud rechazada';
    if (!Number.isInteger(creditId) || creditId <= 0) {
      return res.status(400).json({ success: false, message: 'ID de credito invalido' });
    }

    await dbClient.query('BEGIN');

    const creditColumns = await getTableColumns(dbClient, 'op', 'creditos');
    const creditColumnMap = {
      id: pickExistingColumn(creditColumns, ['id']),
      codigo: pickExistingColumn(creditColumns, ['codigo', 'numero_credito']),
      clienteId: pickExistingColumn(creditColumns, ['cliente_id', 'client_id']),
      estado: pickExistingColumn(creditColumns, ['estado', 'status']),
      observaciones: pickExistingColumn(creditColumns, ['observaciones', 'notes']),
    };
    const requiredCreditColumns = [
      creditColumnMap.id,
      creditColumnMap.estado,
    ];
    if (requiredCreditColumns.some((column) => !column)) {
      throw new Error('La tabla op.creditos no tiene columnas minimas para rechazar');
    }

    const selectedCreditResult = await dbClient.query(
      `SELECT ${creditColumnMap.id} AS id,
              ${creditColumnMap.estado} AS estado,
              ${creditColumnMap.codigo ? `${creditColumnMap.codigo} AS codigo,` : `NULL AS codigo,`}
              ${creditColumnMap.clienteId ? `${creditColumnMap.clienteId} AS cliente_id,` : `NULL AS cliente_id,`}
              ${creditColumnMap.observaciones ? `${creditColumnMap.observaciones} AS observaciones` : `NULL AS observaciones`}
       FROM op.creditos
       WHERE ${creditColumnMap.id} = $1
         AND ${creditColumnMap.estado} = 'PENDIENTE'
       FOR UPDATE`,
      [creditId],
    );

    if (selectedCreditResult.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Credito no encontrado o no esta pendiente',
      });
    }

    const selectedCredit = selectedCreditResult.rows[0];
    const updateParts = [`${creditColumnMap.estado} = 'RECHAZADO'`];
    const updateValues = [];

    if (creditColumnMap.observaciones) {
      updateValues.push(buildRejectedObservations(selectedCredit.observaciones, rejectionReason));
      updateParts.push(`${creditColumnMap.observaciones} = $${updateValues.length}`);
    }

    updateValues.push(creditId);
    const result = await dbClient.query(
      `UPDATE op.creditos
       SET ${updateParts.join(', ')}
       WHERE ${creditColumnMap.id} = $${updateValues.length}
       RETURNING ${creditColumnMap.id} AS id,
                 ${creditColumnMap.codigo ? `${creditColumnMap.codigo} AS codigo,` : `'N/A' AS codigo,`}
                 ${creditColumnMap.clienteId ? `${creditColumnMap.clienteId} AS cliente_id,` : `NULL AS cliente_id,`}
                 ${creditColumnMap.estado} AS estado`,
      updateValues,
    );

    await dbClient.query('COMMIT');

    res.json({
      success: true,
      message: 'Credito rechazado correctamente',
      loan: result.rows[0],
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}
    console.error('Error rechazando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error rechazando credito',
    });
  } finally {
    dbClient.release();
  }
};

export const getAllLoans = async (req, res) => {
  try {
    const status = req.query.status ? normalizeStatus(req.query.status) : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const onlyOwnLoans = !canAuthorizeLoans(req.userRole);
    const creditColumns = await getTableColumns(pool, 'op', 'creditos');
    const creditQuotaColumn = pickExistingColumn(creditColumns, ['cuota_referencial', 'monthly_payment']);
    const cuotaReferencialSelect = creditQuotaColumn
      ? `COALESCE(first_row.cuota_total, cr.${creditQuotaColumn}) AS cuota_referencial`
      : `COALESCE(first_row.cuota_total, 0) AS cuota_referencial`;

    const whereConditions = [];
    const params = [];
    if (status) {
      params.push(status);
      whereConditions.push(`cr.estado = $${params.length}`);
    }
    if (onlyOwnLoans) {
      params.push(req.userId);
      whereConditions.push(`cr.asesor_id = $${params.length}`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    params.push(limit);
    params.push(offset);

    const rowsResult = await query(
      `SELECT cr.id,
              cr.codigo,
              cr.cliente_id,
              (cl.nombres || ' ' || cl.apellidos) AS cliente_nombre,
              cl.email AS cliente_email,
              cr.tipo_credito,
              cr.monto_solicitado,
              cr.tasa_interes,
              cr.plazo_meses,
              cr.estado,
              cr.fecha_solicitud,
              cr.fecha_aprobacion,
              cr.destino,
              (ua.nombres || ' ' || ua.apellidos) AS asesor_nombre,
              ${cuotaReferencialSelect}
       FROM op.creditos cr
       JOIN cl.clientes cl ON cl.id = cr.cliente_id
       LEFT JOIN us.usuarios ua ON ua.id = cr.asesor_id
       LEFT JOIN LATERAL (
          SELECT am.cuota_total
          FROM op.amortizaciones am
          WHERE am.credito_id = cr.id
          ORDER BY am.numero_cuota
          LIMIT 1
       ) first_row ON true
       ${whereClause}
       ORDER BY cr.fecha_solicitud DESC
       LIMIT $${params.length - 1}
       OFFSET $${params.length}`,
      params,
    );

    const countParams = [];
    const countWhereConditions = [];
    if (status) {
      countParams.push(status);
      countWhereConditions.push(`cr.estado = $${countParams.length}`);
    }
    if (onlyOwnLoans) {
      countParams.push(req.userId);
      countWhereConditions.push(`cr.asesor_id = $${countParams.length}`);
    }
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM op.creditos cr
       ${countWhereConditions.length > 0 ? `WHERE ${countWhereConditions.join(' AND ')}` : ''}`,
      countParams,
    );

    const loans = rowsResult.rows.map((row) => ({
      id: row.id,
      codigo: row.codigo,
      cliente_id: row.cliente_id,
      cliente_nombre: row.cliente_nombre,
      cliente_email: row.cliente_email,
      tipo_credito: row.tipo_credito,
      monto_solicitado: parseNumber(row.monto_solicitado),
      monto_aprobado: normalizeStatus(row.estado) === 'APROBADO' ? parseNumber(row.monto_solicitado) : null,
      tasa_interes: parseNumber(row.tasa_interes),
      plazo_meses: row.plazo_meses,
      estado: normalizeStatus(row.estado),
      fecha_solicitud: row.fecha_solicitud,
      fecha_aprobacion: row.fecha_aprobacion,
      asesor_nombre: row.asesor_nombre,
      cuota_referencial: parseNumber(row.cuota_referencial),
      client_id: row.cliente_id,
      client_name: row.cliente_nombre,
      email: row.cliente_email,
      loan_type: row.tipo_credito,
      amount_requested: parseNumber(row.monto_solicitado),
      amount_approved: normalizeStatus(row.estado) === 'APROBADO' ? parseNumber(row.monto_solicitado) : null,
      term_months: row.plazo_meses,
      annual_interest_rate: parseNumber(row.tasa_interes),
      monthly_payment: parseNumber(row.cuota_referencial),
      status: normalizeStatus(row.estado),
      created_at: row.fecha_solicitud,
      approval_date: row.fecha_aprobacion,
      advisor_name: row.asesor_nombre,
    }));

    res.json({
      success: true,
      loans,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
      },
    });
  } catch (error) {
    console.error('Error obteniendo creditos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo creditos',
    });
  }
};

export const getLoanDetails = async (req, res) => {
  try {
    const creditId = parseInt(req.params.id, 10);
    const onlyOwnLoans = !canAuthorizeLoans(req.userRole);
    const params = [creditId];
    const ownershipFilter = onlyOwnLoans ? ` AND cr.asesor_id = $${params.push(req.userId)}` : '';

    const loanResult = await query(
      `SELECT cr.*,
              (cl.nombres || ' ' || cl.apellidos) AS cliente_nombre,
              cl.email AS cliente_email,
              cl.telefono AS cliente_telefono,
              (ua.nombres || ' ' || ua.apellidos) AS asesor_nombre,
              (up.nombres || ' ' || up.apellidos) AS aprobador_nombre
       FROM op.creditos cr
       JOIN cl.clientes cl ON cl.id = cr.cliente_id
       LEFT JOIN us.usuarios ua ON ua.id = cr.asesor_id
       LEFT JOIN us.usuarios up ON up.id = cr.aprobado_por
       WHERE cr.id = $1${ownershipFilter}`,
      params,
    );

    if (loanResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credito no encontrado',
      });
    }

    const amortizationResult = await query(
      `SELECT numero_cuota,
              fecha_vencimiento,
              capital,
              interes,
              cuota_total,
              saldo_capital,
              estado,
              fecha_pago,
              monto_pagado
       FROM op.amortizaciones
       WHERE credito_id = $1
       ORDER BY numero_cuota`,
      [creditId],
    );

    res.json({
      success: true,
      loan: loanResult.rows[0],
      amortization: amortizationResult.rows,
    });
  } catch (error) {
    console.error('Error obteniendo detalle del credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo detalle del credito',
    });
  }
};

export const registerInstallmentPayment = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    if (!canAuthorizeLoans(req.userRole)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para registrar pagos' });
    }

    const creditId = parseInt(req.params.id, 10);
    const installmentNumber = parseInt(req.params.installmentNumber, 10);
    const paidAmountInput = req.body.paidAmount;
    const paymentDateInput = req.body.paymentDate;

    if (!Number.isInteger(creditId) || creditId <= 0 || !Number.isInteger(installmentNumber) || installmentNumber <= 0) {
      return res.status(400).json({ success: false, message: 'Identificadores invalidos para registrar pago' });
    }

    await dbClient.query('BEGIN');

    const amortizationColumns = await getTableColumns(dbClient, 'op', 'amortizaciones');
    const amortizationColumnMap = {
      creditoId: pickExistingColumn(amortizationColumns, ['credito_id', 'loan_id']),
      numeroCuota: pickExistingColumn(amortizationColumns, ['numero_cuota', 'payment_number']),
      cuotaTotal: pickExistingColumn(amortizationColumns, ['cuota_total', 'total_amount']),
      estado: pickExistingColumn(amortizationColumns, ['estado', 'status']),
      fechaPago: pickExistingColumn(amortizationColumns, ['fecha_pago', 'paid_date']),
      montoPagado: pickExistingColumn(amortizationColumns, ['monto_pagado', 'paid_amount']),
    };

    const requiredColumns = [
      amortizationColumnMap.creditoId,
      amortizationColumnMap.numeroCuota,
      amortizationColumnMap.cuotaTotal,
      amortizationColumnMap.estado,
    ];
    if (requiredColumns.some((column) => !column)) {
      throw new Error('La tabla op.amortizaciones no tiene columnas minimas para registrar pago');
    }

    const installmentResult = await dbClient.query(
      `SELECT ${amortizationColumnMap.numeroCuota} AS numero_cuota,
              ${amortizationColumnMap.cuotaTotal} AS cuota_total,
              ${amortizationColumnMap.estado} AS estado
              ${amortizationColumnMap.fechaPago ? `, ${amortizationColumnMap.fechaPago} AS fecha_pago` : ', NULL AS fecha_pago'}
              ${amortizationColumnMap.montoPagado ? `, ${amortizationColumnMap.montoPagado} AS monto_pagado` : ', NULL AS monto_pagado'}
       FROM op.amortizaciones
       WHERE ${amortizationColumnMap.creditoId} = $1
         AND ${amortizationColumnMap.numeroCuota} = $2
       FOR UPDATE`,
      [creditId, installmentNumber],
    );

    if (installmentResult.rowCount === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Cuota no encontrada' });
    }

    const installment = installmentResult.rows[0];
    if (isPaidInstallmentStatus(installment.estado)) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'La cuota ya fue registrada como pagada' });
    }

    const cuotaTotal = parseNumber(installment.cuota_total, 0);
    const paidAmount = paidAmountInput === undefined || paidAmountInput === null || paidAmountInput === ''
      ? cuotaTotal
      : parseNumber(paidAmountInput, NaN);

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'El monto pagado debe ser mayor que cero' });
    }

    if (round2(paidAmount) < round2(cuotaTotal)) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'El monto pagado no puede ser menor a la cuota total mientras el sistema solo maneje cuotas canceladas completas',
      });
    }

    const updateParts = [`${amortizationColumnMap.estado} = 'PAGADO'`];
    const updateValues = [];

    if (amortizationColumnMap.fechaPago) {
      if (paymentDateInput) {
        updateValues.push(paymentDateInput);
        updateParts.push(`${amortizationColumnMap.fechaPago} = $${updateValues.length}`);
      } else {
        updateParts.push(`${amortizationColumnMap.fechaPago} = NOW()`);
      }
    }

    if (amortizationColumnMap.montoPagado) {
      updateValues.push(round2(paidAmount));
      updateParts.push(`${amortizationColumnMap.montoPagado} = $${updateValues.length}`);
    }

    updateValues.push(creditId);
    updateValues.push(installmentNumber);

    const result = await dbClient.query(
      `UPDATE op.amortizaciones
       SET ${updateParts.join(', ')}
       WHERE ${amortizationColumnMap.creditoId} = $${updateValues.length - 1}
         AND ${amortizationColumnMap.numeroCuota} = $${updateValues.length}
       RETURNING ${amortizationColumnMap.numeroCuota} AS numero_cuota,
                 ${amortizationColumnMap.cuotaTotal} AS cuota_total,
                 ${amortizationColumnMap.estado} AS estado
                 ${amortizationColumnMap.fechaPago ? `, ${amortizationColumnMap.fechaPago} AS fecha_pago` : ', NULL AS fecha_pago'}
                 ${amortizationColumnMap.montoPagado ? `, ${amortizationColumnMap.montoPagado} AS monto_pagado` : ', NULL AS monto_pagado'}`,
      updateValues,
    );

    await dbClient.query('COMMIT');

    res.json({
      success: true,
      message: 'Pago registrado correctamente',
      installment: result.rows[0],
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}
    console.error('Error registrando pago de cuota:', error);
    res.status(500).json({
      success: false,
      message: 'Error registrando el pago de la cuota',
    });
  } finally {
    dbClient.release();
  }
};
