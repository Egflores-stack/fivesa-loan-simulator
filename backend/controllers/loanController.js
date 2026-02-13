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

const normalizeStatus = (status = '') => status.toString().trim().toUpperCase();

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

  const result = await query(
    `SELECT codigo, valor
     FROM pa.parametros
     WHERE activo = true
       AND codigo = ANY($1::text[])`,
    [codes],
  );

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
  firstDueDate,
  seguroVidaPct,
  seguroDanosPct,
}) => {
  const monthlyRate = annualRatePct / 100 / 12;
  const rows = [];
  let balance = principal;

  let baseInstallment = 0;
  if (termMonths > 0) {
    if (monthlyRate === 0) {
      baseInstallment = principal / termMonths;
    } else {
      const factor = Math.pow(1 + monthlyRate, termMonths);
      baseInstallment = (principal * monthlyRate * factor) / (factor - 1);
    }
  }

  for (let installment = 1; installment <= termMonths; installment += 1) {
    let interest = balance * monthlyRate;
    let capital = baseInstallment - interest;

    if (installment === termMonths) {
      capital = balance;
      interest = baseInstallment - capital;
    }

    const lifeInsurance = balance * (seguroVidaPct / 100);
    const damageInsurance = balance * (seguroDanosPct / 100);
    const payment = capital + interest + lifeInsurance + damageInsurance;

    balance = Math.max(0, balance - capital);

    rows.push({
      numeroCuota: installment,
      fechaVencimiento: toDateOnly(addMonths(firstDueDate, installment - 1)),
      capital: round2(capital),
      interes: round2(interest),
      seguroVida: round2(lifeInsurance),
      seguroDanos: round2(damageInsurance),
      cuotaTotal: round2(payment),
      saldoCapital: round2(balance),
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

export const calculateLoan = async (req, res) => {
  try {
    const principal = parseNumber(req.body.amount ?? req.body.monto_solicitado, 0);
    const termMonths = parseInt(req.body.termMonths ?? req.body.plazo_meses, 10);
    const annualRatePct = parseNumber(req.body.annualRate ?? req.body.tasa_interes, 0);
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
      error: error.message,
    });
  }
};

export const createLoan = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const userId = req.userId;
    const clienteId = parseInt(req.body.cliente_id ?? req.body.clientId, 10);
    const montoSolicitado = parseNumber(req.body.monto_solicitado ?? req.body.amountRequested, 0);
    const tasaInteres = parseNumber(req.body.tasa_interes ?? req.body.annualInterestRate, 0);
    const plazoMeses = parseInt(req.body.plazo_meses ?? req.body.termMonths, 10);
    const tipoCredito = req.body.tipo_credito ?? req.body.loanType ?? 'PERSONAL';
    const destino = req.body.destino ?? req.body.purpose ?? null;
    const observacionesEntrada = req.body.observaciones ?? null;
    const firstDueDate = req.body.firstDueDate
      ? new Date(req.body.firstDueDate)
      : addMonths(new Date(), 1);

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({ success: false, message: 'cliente_id es obligatorio' });
    }
    if (montoSolicitado <= 0 || tasaInteres < 0 || !Number.isInteger(plazoMeses) || plazoMeses <= 0) {
      return res.status(400).json({ success: false, message: 'Datos del credito invalidos' });
    }

    const customerExists = await dbClient.query(
      'SELECT id FROM cl.clientes WHERE id = $1 AND activo = true',
      [clienteId],
    );
    if (customerExists.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    }

    const parameters = await getFinancialParameters();
    const seguroVidaPct = parseNumber(req.body.seguroVidaPct, parameters.seguroVidaPct);
    const seguroDanosPct = parseNumber(req.body.seguroDanosPct, parameters.seguroDanosPct);
    const comisionPct = parseNumber(req.body.comisionPct, parameters.comisionPct);

    const amortization = buildFrenchAmortization({
      principal: montoSolicitado,
      annualRatePct: tasaInteres,
      termMonths: plazoMeses,
      firstDueDate,
      seguroVidaPct,
      seguroDanosPct,
    });

    const totalComision = round2(montoSolicitado * (comisionPct / 100));
    const metadata = {
      seguroVidaPct: round2(seguroVidaPct),
      seguroDanosPct: round2(seguroDanosPct),
      comisionPct: round2(comisionPct),
      totalComision,
    };
    const observaciones = JSON.stringify({
      nota: observacionesEntrada,
      calculo: metadata,
    });

    await dbClient.query('BEGIN');

    const codigo = await generateCreditCode(dbClient);

    const creditResult = await dbClient.query(
      `INSERT INTO op.creditos
       (codigo, cliente_id, monto_solicitado, tasa_interes, plazo_meses, tipo_credito, destino, estado, observaciones, asesor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE', $8, $9)
       RETURNING id, codigo, fecha_solicitud, estado`,
      [codigo, clienteId, montoSolicitado, tasaInteres, plazoMeses, tipoCredito, destino, observaciones, userId],
    );

    const creditoId = creditResult.rows[0].id;

    for (const row of amortization.rows) {
      await dbClient.query(
        `INSERT INTO op.amortizaciones
         (credito_id, numero_cuota, fecha_vencimiento, capital, interes, cuota_total, saldo_capital, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE')`,
        [
          creditoId,
          row.numeroCuota,
          row.fechaVencimiento,
          row.capital,
          row.interes,
          row.cuotaTotal,
          row.saldoCapital,
        ],
      );
    }

    await dbClient.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Solicitud de credito creada correctamente',
      loan: {
        id: creditoId,
        codigo,
        cliente_id: clienteId,
        monto_solicitado: round2(montoSolicitado),
        tasa_interes: round2(tasaInteres),
        plazo_meses: plazoMeses,
        estado: creditResult.rows[0].estado,
        fecha_solicitud: creditResult.rows[0].fecha_solicitud,
      },
      calculation: {
        cuotaReferencial: amortization.firstInstallmentAmount,
        ...amortization.totals,
        totalComision,
      },
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando la solicitud de credito',
      error: error.message,
    });
  } finally {
    dbClient.release();
  }
};

export const approveLoan = async (req, res) => {
  try {
    const creditId = parseInt(req.params.id, 10);
    const userId = req.userId;

    const result = await query(
      `UPDATE op.creditos
       SET estado = 'APROBADO',
           aprobado_por = $1,
           fecha_aprobacion = NOW()
       WHERE id = $2
         AND estado = 'PENDIENTE'
       RETURNING id, codigo, cliente_id, estado, fecha_aprobacion`,
      [userId, creditId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credito no encontrado o no esta pendiente',
      });
    }

    res.json({
      success: true,
      message: 'Credito aprobado correctamente',
      loan: result.rows[0],
    });
  } catch (error) {
    console.error('Error aprobando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error aprobando credito',
      error: error.message,
    });
  }
};

export const rejectLoan = async (req, res) => {
  try {
    const creditId = parseInt(req.params.id, 10);
    const rejectionReason = req.body.rejectionReason ?? req.body.observaciones ?? 'Solicitud rechazada';

    const result = await query(
      `UPDATE op.creditos
       SET estado = 'RECHAZADO',
           observaciones = COALESCE(observaciones, '') || E'\nRECHAZO: ' || $1
       WHERE id = $2
         AND estado = 'PENDIENTE'
       RETURNING id, codigo, cliente_id, estado`,
      [rejectionReason, creditId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Credito no encontrado o no esta pendiente',
      });
    }

    res.json({
      success: true,
      message: 'Credito rechazado correctamente',
      loan: result.rows[0],
    });
  } catch (error) {
    console.error('Error rechazando credito:', error);
    res.status(500).json({
      success: false,
      message: 'Error rechazando credito',
      error: error.message,
    });
  }
};

export const getAllLoans = async (req, res) => {
  try {
    const status = req.query.status ? normalizeStatus(req.query.status) : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];
    if (status) {
      params.push(status);
      whereClause = `WHERE cr.estado = $${params.length}`;
    }

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
              first_row.cuota_total AS cuota_referencial
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

    const countParams = status ? [status] : [];
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM op.creditos cr
       ${status ? 'WHERE cr.estado = $1' : ''}`,
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
      error: error.message,
    });
  }
};

export const getLoanDetails = async (req, res) => {
  try {
    const creditId = parseInt(req.params.id, 10);

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
       WHERE cr.id = $1`,
      [creditId],
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
      error: error.message,
    });
  }
};
