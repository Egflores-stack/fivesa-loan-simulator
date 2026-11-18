import { query } from '../db.js';

const parseProfileExtras = (rawEstadoCivil) => {
  if (!rawEstadoCivil || typeof rawEstadoCivil !== 'string') return {};
  try {
    const parsed = JSON.parse(rawEstadoCivil);
    if (parsed && typeof parsed === 'object' && parsed.fivesa_profile && typeof parsed.fivesa_profile === 'object') {
      return parsed.fivesa_profile;
    }
    return {};
  } catch {
    return {};
  }
};

const normalizeClient = (row) => ({
  ...(parseProfileExtras(row.estado_civil)),
  ...row,
  full_name: `${row.nombres} ${row.apellidos}`.trim(),
  first_name: row.nombres,
  last_name: row.apellidos,
  dpi: row.identificacion,
  nombre: `${row.nombres} ${row.apellidos}`.trim(),
  cedula: row.identificacion,
  telefono_1: row.telefono,
  monthly_income: row.ingreso_mensual,
  phone: row.telefono,
  birth_date: row.fecha_nacimiento,
});

export const registerClient = async (req, res) => {
  try {
    const userId = req.userId;
    const identificacion = req.body.identificacion ?? req.body.dpi;
    const nombres = req.body.nombres ?? req.body.first_name;
    const apellidos = req.body.apellidos ?? req.body.last_name;

    if (!identificacion || !nombres || !apellidos) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'identificacion, nombres y apellidos son obligatorios',
        fieldErrors: {
          ...(identificacion ? {} : { identificacion: 'La identificacion es obligatoria' }),
          ...(nombres ? {} : { nombres: 'Los nombres son obligatorios' }),
          ...(apellidos ? {} : { apellidos: 'Los apellidos son obligatorios' }),
        },
      });
    }

    const email = req.body.email ?? null;
    const fivesaProfile = req.body.fivesa_profile ?? {};
    const encodedEstadoCivil = JSON.stringify({
      fivesa_profile: fivesaProfile,
    });

    const existingIdentification = await query(
      'SELECT id FROM cl.clientes WHERE identificacion = $1',
      [identificacion],
    );

    if (existingIdentification.rowCount > 0) {
      return res.status(400).json({
        success: false,
        code: 'DUPLICATE_IDENTIFICACION',
        message: 'Ya existe un cliente con esta identificacion',
        fieldErrors: {
          identificacion: 'La cedula ya existe',
        },
      });
    }

    if (email) {
      const existingEmail = await query(
        'SELECT id FROM cl.clientes WHERE email = $1',
        [email],
      );

      if (existingEmail.rowCount > 0) {
        return res.status(400).json({
          success: false,
          code: 'DUPLICATE_EMAIL',
          message: 'Ya existe un cliente con este email',
          fieldErrors: {
            email: 'El correo ya existe',
          },
        });
      }
    }

    const result = await query(
      `INSERT INTO cl.clientes
       (identificacion, tipo_identificacion, nombres, apellidos, fecha_nacimiento, genero, telefono, email, direccion,
        ocupacion, ingreso_mensual, estado_civil, asesor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, identificacion, tipo_identificacion, nombres, apellidos, fecha_nacimiento, genero, telefono,
                 email, direccion, ocupacion, ingreso_mensual, estado_civil, activo, creado_en, asesor_id`,
      [
        identificacion,
        req.body.tipo_identificacion ?? 'DNI',
        nombres,
        apellidos,
        req.body.fecha_nacimiento ?? req.body.birth_date ?? null,
        req.body.genero ?? null,
        req.body.telefono ?? req.body.phone ?? null,
        email,
        req.body.direccion ?? req.body.address ?? null,
        req.body.ocupacion ?? req.body.employment_status ?? null,
        req.body.ingreso_mensual ?? req.body.monthly_income ?? null,
        encodedEstadoCivil,
        userId,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente',
      client: normalizeClient(result.rows[0]),
    });
  } catch (error) {
    console.error('Error registrando cliente:', error);
    if (error?.code === '23505') {
      const detail = String(error?.detail ?? '').toLowerCase();
      const isEmail = detail.includes('email');
      return res.status(400).json({
        success: false,
        code: isEmail ? 'DUPLICATE_EMAIL' : 'DUPLICATE_IDENTIFICACION',
        message: isEmail ? 'Ya existe un cliente con este email' : 'Ya existe un cliente con esta identificacion',
        fieldErrors: {
          [isEmail ? 'email' : 'identificacion']: isEmail ? 'El correo ya existe' : 'La cedula ya existe',
        },
      });
    }
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Error registrando cliente',
    });
  }
};

export const checkClientExists = async (req, res) => {
  try {
    const identificacion = String(req.query.identificacion ?? '').trim();
    const email = String(req.query.email ?? '').trim();

    if (!identificacion && !email) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Debes enviar identificacion o email para validar',
      });
    }

    let byIdentification = null;
    let byEmail = null;

    if (identificacion) {
      const result = await query(
        'SELECT id FROM cl.clientes WHERE identificacion = $1 LIMIT 1',
        [identificacion],
      );
      byIdentification = result.rows[0] ?? null;
    }

    if (email) {
      const result = await query(
        'SELECT id FROM cl.clientes WHERE email = $1 LIMIT 1',
        [email],
      );
      byEmail = result.rows[0] ?? null;
    }

    res.json({
      success: true,
      existsByIdentificacion: Boolean(byIdentification),
      existsByEmail: Boolean(byEmail),
      clientId: byIdentification?.id ?? byEmail?.id ?? null,
    });
  } catch (error) {
    console.error('Error validando existencia de cliente:', error);
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Error validando cliente',
    });
  }
};

export const getAllClients = async (req, res) => {
  try {
    const search = (req.query.search ?? '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (c.nombres ILIKE $${params.length} OR
                           c.apellidos ILIKE $${params.length} OR
                           c.email ILIKE $${params.length} OR
                           c.identificacion ILIKE $${params.length})`;
    }

    params.push(limit);
    params.push(offset);

    const clientsResult = await query(
      `SELECT c.id, c.identificacion, c.tipo_identificacion, c.nombres, c.apellidos,
              c.fecha_nacimiento, c.genero, c.telefono, c.email, c.direccion,
              c.ocupacion, c.ingreso_mensual, c.estado_civil, c.activo, c.creado_en, c.asesor_id
       FROM cl.clientes c
       ${whereClause}
       ORDER BY c.creado_en DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = search ? [`%${search}%`] : [];
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM cl.clientes c
       ${search
         ? `WHERE c.nombres ILIKE $1 OR c.apellidos ILIKE $1 OR c.email ILIKE $1 OR c.identificacion ILIKE $1`
         : ''}`,
      countParams,
    );

    res.json({
      success: true,
      clients: clientsResult.rows.map(normalizeClient),
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
      },
    });
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo clientes',
    });
  }
};

export const getClientById = async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    const result = await query(
      `SELECT c.*,
              (u.nombres || ' ' || u.apellidos) AS asesor_nombre
       FROM cl.clientes c
       LEFT JOIN us.usuarios u ON u.id = c.asesor_id
       WHERE c.id = $1`,
      [clientId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado',
      });
    }

    const loansResult = await query(
      `SELECT id, codigo, monto_solicitado, tasa_interes, plazo_meses,
              tipo_credito, estado, fecha_solicitud, fecha_aprobacion
       FROM op.creditos
       WHERE cliente_id = $1
       ORDER BY fecha_solicitud DESC`,
      [clientId],
    );

    res.json({
      success: true,
      client: normalizeClient(result.rows[0]),
      loans: loansResult.rows,
    });
  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo cliente',
    });
  }
};

export const updateClient = async (req, res) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    const fieldMap = {
      identificacion: 'identificacion',
      tipo_identificacion: 'tipo_identificacion',
      nombres: 'nombres',
      apellidos: 'apellidos',
      fecha_nacimiento: 'fecha_nacimiento',
      genero: 'genero',
      telefono: 'telefono',
      email: 'email',
      direccion: 'direccion',
      ocupacion: 'ocupacion',
      ingreso_mensual: 'ingreso_mensual',
      estado_civil: 'estado_civil',
      activo: 'activo',
      first_name: 'nombres',
      last_name: 'apellidos',
      phone: 'telefono',
      monthly_income: 'ingreso_mensual',
      birth_date: 'fecha_nacimiento',
      dpi: 'identificacion',
    };

    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(req.body)) {
      const column = fieldMap[key];
      if (column) {
        values.push(value);
        setClause.push(`${column} = $${values.length}`);
      }
    }

    if (req.body.fivesa_profile && typeof req.body.fivesa_profile === 'object') {
      values.push(JSON.stringify({ fivesa_profile: req.body.fivesa_profile }));
      setClause.push(`estado_civil = $${values.length}`);
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos validos para actualizar',
      });
    }

    values.push(clientId);

    const result = await query(
      `UPDATE cl.clientes
       SET ${setClause.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, identificacion, tipo_identificacion, nombres, apellidos, fecha_nacimiento, genero, telefono,
                 email, direccion, ocupacion, ingreso_mensual, estado_civil, activo, creado_en, asesor_id`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      client: normalizeClient(result.rows[0]),
    });
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando cliente',
    });
  }
};
