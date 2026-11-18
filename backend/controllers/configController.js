import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import {
  isSuperAdminIdentity,
  normalizeRoleForClient,
  normalizeRoleForStorage,
  resolveAuthSource,
} from '../auth.js';

const PARAMETER_CODES = {
  diasMoraVencido: 'MORA_DIAS_VENCIDO',
  cuotasVencido: 'MORA_CUOTAS_VENCIDAS',
};

const ACCESS_TYPES = new Set(['Demo', 'Alquiler']);

const buildSuggestedUsername = (firstName = '', lastName = '') => {
  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  const firstInitial = normalize(firstName).charAt(0);
  const lastPart = normalize(lastName);
  return `${firstInitial}${lastPart}`.trim();
};

const ensureSuperAdmin = (req, res) => {
  if (!isSuperAdminIdentity(req.userUsername, req.userEmail)) {
    res.status(403).json({ message: 'Solo el super admin puede gestionar esta parametrizacion' });
    return false;
  }

  return true;
};

const ensureUserMetadataTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS public.user_admin_profiles (
      auth_source TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      company TEXT,
      access_type TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (auth_source, user_id)
    )
  `);
};

const getParameterTableAvailable = async () => {
  const result = await query(`SELECT to_regclass('pa.parametros') IS NOT NULL AS exists`);
  return Boolean(result.rows[0]?.exists);
};

const getUserByEmail = async (authSource, email, excludeId = null) => {
  const loweredEmail = String(email || '').trim().toLowerCase();

  if (!loweredEmail) {
    return null;
  }

  if (authSource === 'us.usuarios') {
    const params = excludeId ? [loweredEmail, excludeId] : [loweredEmail];
    const suffix = excludeId ? 'AND id <> $2' : '';
    const result = await query(
      `SELECT id
       FROM us.usuarios
       WHERE LOWER(email) = $1
         ${suffix}
       LIMIT 1`,
      params,
    );
    return result.rows[0] || null;
  }

  const params = excludeId ? [loweredEmail, excludeId] : [loweredEmail];
  const suffix = excludeId ? 'AND id <> $2' : '';
  const result = await query(
    `SELECT id
     FROM users
     WHERE LOWER(email) = $1
       ${suffix}
     LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
};

const getUserByUsername = async (authSource, username, excludeId = null) => {
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (!normalizedUsername) {
    return null;
  }

  if (authSource === 'us.usuarios') {
    const params = excludeId ? [normalizedUsername, excludeId] : [normalizedUsername];
    const suffix = excludeId ? 'AND id <> $2' : '';
    const result = await query(
      `SELECT id
       FROM us.usuarios
       WHERE LOWER(usuario) = $1
         ${suffix}
       LIMIT 1`,
      params,
    );
    return result.rows[0] || null;
  }

  const params = excludeId ? [normalizedUsername, excludeId] : [normalizedUsername];
  const suffix = excludeId ? 'AND id <> $2' : '';
  const result = await query(
    `SELECT id
     FROM users
     WHERE LOWER(split_part(email, '@', 1)) = $1
       ${suffix}
     LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
};

const mapConfigUser = (row = {}, metadata = {}) => ({
  id: String(row.id),
  email: row.email,
  username: row.username || row.email?.split('@')[0] || '',
  first_name: row.first_name || '',
  last_name: row.last_name || '',
  full_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
  company: metadata.company || '',
  access_type: metadata.access_type || '',
  description: metadata.description || '',
  role: normalizeRoleForClient(row.role),
  is_super_admin: isSuperAdminIdentity(row.username, row.email),
  created_at: row.created_at,
});

const fetchUserMetadataMap = async (authSource, ids = []) => {
  await ensureUserMetadataTable();

  if (ids.length === 0) {
    return new Map();
  }

  const result = await query(
    `SELECT user_id, company, access_type, description
     FROM public.user_admin_profiles
     WHERE auth_source = $1
       AND user_id = ANY($2::int[])`,
    [authSource, ids],
  );

  return new Map(result.rows.map((row) => [String(row.user_id), row]));
};

const upsertUserMetadata = async (dbClient, authSource, userId, metadata = {}) => {
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS public.user_admin_profiles (
      auth_source TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      company TEXT,
      access_type TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (auth_source, user_id)
    )
  `);

  const company = metadata.company ?? null;
  const accessType = metadata.access_type ?? null;
  const description = metadata.description ?? null;

  await dbClient.query(
    `INSERT INTO public.user_admin_profiles (auth_source, user_id, company, access_type, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (auth_source, user_id)
     DO UPDATE SET
       company = EXCLUDED.company,
       access_type = EXCLUDED.access_type,
       description = EXCLUDED.description,
       updated_at = NOW()`,
    [authSource, userId, company, accessType, description],
  );
};

export const fetchUsers = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const authSource = await resolveAuthSource();
    const result = authSource === 'us.usuarios'
      ? await query(
          `SELECT id,
                  usuario AS username,
                  email,
                  nombres AS first_name,
                  apellidos AS last_name,
                  rol AS role,
                  creado_en AS created_at
           FROM us.usuarios
           WHERE activo = true
           ORDER BY creado_en DESC, id DESC`,
        )
      : await query(
          `SELECT id,
                  split_part(email, '@', 1) AS username,
                  email,
                  first_name,
                  last_name,
                  role,
                  created_at
           FROM users
           WHERE is_active = true
           ORDER BY created_at DESC, id DESC`,
        );

    const metadataMap = await fetchUserMetadataMap(authSource, result.rows.map((row) => Number(row.id)));
    res.json({
      users: result.rows.map((row) => mapConfigUser(row, metadataMap.get(String(row.id)))),
    });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ message: 'No se pudieron cargar los usuarios' });
  }
};

export const createUser = async (req, res) => {
  const dbClient = await pool.connect();

  try {
    if (!ensureSuperAdmin(req, res)) return;

    const {
      username,
      first_name,
      last_name,
      email,
      password,
      role = 'Asesor',
      company = '',
      access_type = 'Demo',
      description = '',
    } = req.body;
    const authSource = await resolveAuthSource();

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, apellido, email y clave son requeridos' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'La clave debe tener al menos 6 caracteres' });
    }

    if (!ACCESS_TYPES.has(String(access_type || '').trim())) {
      return res.status(400).json({ message: 'El tipo de acceso debe ser Demo o Alquiler' });
    }

    const normalizedUsername = String(username || buildSuggestedUsername(first_name, last_name)).trim().toLowerCase();
    if (!normalizedUsername) {
      return res.status(400).json({ message: 'No fue posible generar el usuario automaticamente' });
    }

    const existingEmail = await getUserByEmail(authSource, email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    }

    const existingUsername = await getUserByUsername(authSource, normalizedUsername);
    if (existingUsername) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese nombre de usuario' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const storageRole = normalizeRoleForStorage(role, authSource);

    await dbClient.query('BEGIN');

    const result = authSource === 'us.usuarios'
      ? await dbClient.query(
          `INSERT INTO us.usuarios (usuario, email, password_hash, rol, nombres, apellidos, activo, creado_en, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
           RETURNING id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, creado_en AS created_at`,
          [normalizedUsername, email, hashedPassword, storageRole, first_name, last_name],
        )
      : await dbClient.query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
           RETURNING id, split_part(email, '@', 1) AS username, email, first_name, last_name, role, created_at`,
          [email, hashedPassword, first_name, last_name, storageRole],
        );

    const createdUser = result.rows[0];
    await upsertUserMetadata(dbClient, authSource, createdUser.id, {
      company,
      access_type,
      description,
    });

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: 'Usuario creado correctamente',
      user: mapConfigUser(createdUser, { company, access_type, description }),
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}
    console.error('Error creando usuario:', error);
    res.status(500).json({ message: 'No se pudo crear el usuario' });
  } finally {
    dbClient.release();
  }
};

export const updateUser = async (req, res) => {
  const dbClient = await pool.connect();

  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { id } = req.params;
    const {
      username,
      first_name,
      last_name,
      email,
      password,
      role,
      company,
      access_type,
      description,
    } = req.body;
    const authSource = await resolveAuthSource();
    const updates = [];
    const values = [];

    if (!id) {
      return res.status(400).json({ message: 'ID de usuario requerido' });
    }

    if (email) {
      const existingUser = await getUserByEmail(authSource, email, id);
      if (existingUser) {
        return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
      }

      updates.push(`email = $${updates.length + 1}`);
      values.push(email);
    }

    if (first_name) {
      updates.push(authSource === 'us.usuarios' ? `nombres = $${updates.length + 1}` : `first_name = $${updates.length + 1}`);
      values.push(first_name);
    }

    if (last_name) {
      updates.push(authSource === 'us.usuarios' ? `apellidos = $${updates.length + 1}` : `last_name = $${updates.length + 1}`);
      values.push(last_name);
    }

    if (username) {
      const existingUsername = await getUserByUsername(authSource, username, id);
      if (existingUsername) {
        return res.status(400).json({ message: 'Ya existe un usuario con ese nombre de usuario' });
      }

      if (authSource === 'us.usuarios') {
        updates.push(`usuario = $${updates.length + 1}`);
        values.push(String(username).trim().toLowerCase());
      }
    }

    if (role) {
      updates.push(authSource === 'us.usuarios' ? `rol = $${updates.length + 1}` : `role = $${updates.length + 1}`);
      values.push(normalizeRoleForStorage(role, authSource));
    }

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'La clave debe tener al menos 6 caracteres' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${updates.length + 1}`);
      values.push(hashedPassword);
    }

    if (access_type && !ACCESS_TYPES.has(String(access_type || '').trim())) {
      return res.status(400).json({ message: 'El tipo de acceso debe ser Demo o Alquiler' });
    }

    await dbClient.query('BEGIN');

    let updatedUser = null;
    if (updates.length > 0) {
      updates.push(authSource === 'us.usuarios' ? 'actualizado_en = NOW()' : 'updated_at = NOW()');
      values.push(id);

      const result = authSource === 'us.usuarios'
        ? await dbClient.query(
            `UPDATE us.usuarios
             SET ${updates.join(', ')}
             WHERE id = $${values.length}
             RETURNING id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, creado_en AS created_at`,
            values,
          )
        : await dbClient.query(
            `UPDATE users
             SET ${updates.join(', ')}
             WHERE id = $${values.length}
               AND is_active = true
             RETURNING id, split_part(email, '@', 1) AS username, email, first_name, last_name, role, created_at`,
            values,
          );

      if (result.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      updatedUser = result.rows[0];
    } else {
      const result = authSource === 'us.usuarios'
        ? await dbClient.query(
            `SELECT id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, creado_en AS created_at
             FROM us.usuarios
             WHERE id = $1
             LIMIT 1`,
            [id],
          )
        : await dbClient.query(
            `SELECT id, split_part(email, '@', 1) AS username, email, first_name, last_name, role, created_at
             FROM users
             WHERE id = $1
               AND is_active = true
             LIMIT 1`,
            [id],
          );

      if (result.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      updatedUser = result.rows[0];
    }

    await upsertUserMetadata(dbClient, authSource, Number(id), {
      company: company ?? '',
      access_type: access_type ?? '',
      description: description ?? '',
    });

    await dbClient.query('COMMIT');

    res.json({
      message: 'Usuario actualizado correctamente',
      user: mapConfigUser(updatedUser, {
        company: company ?? '',
        access_type: access_type ?? '',
        description: description ?? '',
      }),
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ message: 'No se pudo actualizar el usuario' });
  } finally {
    dbClient.release();
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const { id } = req.params;

    if (String(req.userId) === String(id)) {
      return res.status(400).json({ message: 'No puedes desactivar tu propio usuario' });
    }

    const authSource = await resolveAuthSource();
    const result = authSource === 'us.usuarios'
      ? await query(
          `UPDATE us.usuarios
           SET activo = false,
               actualizado_en = NOW()
           WHERE id = $1
           RETURNING id`,
          [id],
        )
      : await query(
          `UPDATE users
           SET is_active = false,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id`,
          [id],
        );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error desactivando usuario:', error);
    res.status(500).json({ message: 'No se pudo eliminar el usuario' });
  }
};

export const fetchParameters = async (req, res) => {
  try {
    if (!ensureSuperAdmin(req, res)) return;

    const hasTable = await getParameterTableAvailable();
    if (!hasTable) {
      return res.json({
        parameters: {
          dias_mora_vencido: 0,
          cuotas_vencido: 0,
        },
      });
    }

    const result = await query(
      `SELECT codigo, valor
       FROM pa.parametros
       WHERE codigo = ANY($1::text[])`,
      [[PARAMETER_CODES.diasMoraVencido, PARAMETER_CODES.cuotasVencido]],
    );

    const asMap = new Map(result.rows.map((row) => [row.codigo, Number(row.valor) || 0]));

    res.json({
      parameters: {
        dias_mora_vencido: asMap.get(PARAMETER_CODES.diasMoraVencido) ?? 0,
        cuotas_vencido: asMap.get(PARAMETER_CODES.cuotasVencido) ?? 0,
      },
    });
  } catch (error) {
    console.error('Error consultando parametros:', error);
    res.status(500).json({ message: 'No se pudieron cargar los parametros' });
  }
};

export const updateParameters = async (req, res) => {
  const dbClient = await pool.connect();

  try {
    if (!ensureSuperAdmin(req, res)) return;

    const hasTable = await getParameterTableAvailable();
    if (!hasTable) {
      return res.status(404).json({ message: 'La tabla pa.parametros no existe en esta base de datos' });
    }

    const diasMoraVencido = Number(req.body.diasMoraVencido ?? 0);
    const cuotasVencido = Number(req.body.cuotasVencido ?? 0);

    if (!Number.isFinite(diasMoraVencido) || diasMoraVencido < 0 || !Number.isFinite(cuotasVencido) || cuotasVencido < 0) {
      return res.status(400).json({ message: 'Los parametros deben ser numeros iguales o mayores que cero' });
    }

    await dbClient.query('BEGIN');

    for (const [code, value] of [
      [PARAMETER_CODES.diasMoraVencido, diasMoraVencido],
      [PARAMETER_CODES.cuotasVencido, cuotasVencido],
    ]) {
      const updateResult = await dbClient.query(
        `UPDATE pa.parametros
         SET valor = $1,
             activo = true
         WHERE codigo = $2`,
        [String(value), code],
      );

      if (updateResult.rowCount === 0) {
        await dbClient.query(
          `INSERT INTO pa.parametros (codigo, valor, activo)
           VALUES ($1, $2, true)`,
          [code, String(value)],
        );
      }
    }

    await dbClient.query('COMMIT');

    res.json({
      message: 'Parametros actualizados correctamente',
      parameters: {
        dias_mora_vencido: diasMoraVencido,
        cuotas_vencido: cuotasVencido,
      },
    });
  } catch (error) {
    try {
      await dbClient.query('ROLLBACK');
    } catch {}

    console.error('Error actualizando parametros:', error);
    res.status(500).json({ message: 'No se pudieron actualizar los parametros' });
  } finally {
    dbClient.release();
  }
};
