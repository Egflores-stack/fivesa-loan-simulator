import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const getDemoAccessStatus = () => {
    const enabled = String(process.env.DEMO_MODE_ENABLED || '').trim().toLowerCase() === 'true';
    const expiresAtRaw = String(process.env.DEMO_MODE_EXPIRES_AT || '').trim();

    if (!enabled || !expiresAtRaw) {
        return { enabled, expired: false, expiresAtRaw };
    }

    const expiresAt = new Date(expiresAtRaw);
    if (Number.isNaN(expiresAt.getTime())) {
        return { enabled, expired: false, expiresAtRaw, invalidDate: true };
    }

    return {
        enabled,
        expired: Date.now() > expiresAt.getTime(),
        expiresAt,
        expiresAtRaw,
    };
};

const ensureDemoAccess = () => {
    const demoStatus = getDemoAccessStatus();

    if (demoStatus.enabled && demoStatus.expired) {
        const expiresLabel = demoStatus.expiresAtRaw || 'la fecha configurada';
        const error = new Error(`El acceso demo vencio el ${expiresLabel}`);
        error.code = 'DEMO_ACCESS_EXPIRED';
        throw error;
    }

    return demoStatus;
};

const getSuperAdminUsername = () =>
    String(process.env.SUPER_ADMIN_USERNAME || 'emathews').trim().toLowerCase();

export const isSuperAdminIdentity = (username, email) => {
    const expected = getSuperAdminUsername();
    const usernameValue = String(username || '').trim().toLowerCase();
    const emailValue = String(email || '').trim().toLowerCase();
    const emailUsername = emailValue.includes('@') ? emailValue.split('@')[0] : emailValue;

    return usernameValue === expected || emailUsername === expected;
};

export const resolveAuthSource = async () => {
    const sourceCheck = await query(`
        SELECT
            to_regclass('us.usuarios') IS NOT NULL AS has_usuarios,
            to_regclass('public.users') IS NOT NULL AS has_users
    `);

    const { has_usuarios, has_users } = sourceCheck.rows[0] || {};

    if (has_usuarios) return 'us.usuarios';
    if (has_users) return 'public.users';
    throw new Error('No existe tabla de autenticacion (us.usuarios ni public.users)');
};

export const normalizeRoleForClient = (role) => {
    const normalized = String(role || '').trim().toLowerCase();

    if (normalized === 'admin' || normalized === 'administrador') {
        return 'Administrador';
    }

    if (normalized === 'supervisor') {
        return 'Supervisor';
    }

    return 'Asesor';
};

export const normalizeRoleForStorage = (role, authSource) => {
    const normalized = String(role || '').trim().toLowerCase();
    const isUsuariosTable = authSource === 'us.usuarios';

    if (normalized === 'admin' || normalized === 'administrador') {
        return isUsuariosTable ? 'Administrador' : 'admin';
    }

    if (normalized === 'supervisor') {
        return isUsuariosTable ? 'Supervisor' : 'supervisor';
    }

    return isUsuariosTable ? 'Asesor' : 'asesor';
};

export const isAdminRole = (role) => normalizeRoleForClient(role) === 'Administrador';
export const canAuthorizeLoans = (role) => {
    const normalized = normalizeRoleForClient(role);
    return normalized === 'Administrador' || normalized === 'Supervisor';
};

const buildUserResponse = (user = {}) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return {
        id: user.id,
        email: user.email,
        username: user.username || user.email?.split('@')[0] || '',
        first_name: firstName,
        last_name: lastName,
        role: normalizeRoleForClient(user.role),
        full_name: fullName,
        cod_empresa: user.cod_empresa || 'MAIN',
        is_super_admin: isSuperAdminIdentity(user.username, user.email),
        is_active: user.is_active,
        created_at: user.created_at,
    };
};

// Registrar usuario
export const register = async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'asesor', cod_empresa = 'MAIN' } = req.body;
        const authSource = await resolveAuthSource();
        const storageRole = normalizeRoleForStorage(role, authSource);

        if (!email || !password) {
            return res.status(400).json({ message: 'Email y clave son requeridos' });
        }

        const normalizedUsername = (username || email.split('@')[0] || '').trim();
        
        // Verificar si el usuario ya existe
        const userCheck = authSource === 'us.usuarios'
            ? await query('SELECT id FROM us.usuarios WHERE LOWER(usuario) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1', [normalizedUsername, email])
            : await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }
        
        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insertar usuario
        const result = authSource === 'us.usuarios'
            ? await query(
                `INSERT INTO us.usuarios (usuario, email, password_hash, rol, nombres, apellidos, activo, cod_empresa, creado_en, actualizado_en)
                 VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW(), NOW())
                 RETURNING id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, activo AS is_active, cod_empresa, creado_en AS created_at`,
                [normalizedUsername, email, hashedPassword, storageRole, first_name || '', last_name || '', cod_empresa]
            )
            : await query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, cod_empresa, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 RETURNING id, split_part(email, '@', 1) AS username, email, first_name, last_name, role, is_active, cod_empresa, created_at`,
                [email, hashedPassword, first_name || '', last_name || '', storageRole, cod_empresa]
            );
        
        const newUser = buildUserResponse(result.rows[0]);
        
        res.status(201).json({ 
            message: 'Usuario registrado exitosamente',
            user: newUser
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Login
export const login = async (req, res) => {
    try {
        ensureDemoAccess();

        const { username, email, password } = req.body;
        const identifier = (username || email || '').trim().toLowerCase();
        const authSource = await resolveAuthSource();

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Usuario y clave son requeridos' });
        }
        
        // Buscar usuario por username con compatibilidad por email
        const result = authSource === 'us.usuarios'
            ? await query(
                `SELECT id, usuario AS username, email, password_hash, rol AS role, nombres AS first_name, apellidos AS last_name, activo AS is_active, cod_empresa
                 FROM us.usuarios
                 WHERE activo = true
                   AND (LOWER(usuario) = $1 OR LOWER(email) = $1)
                 LIMIT 1`,
                [identifier]
            )
            : await query(
                `SELECT id, split_part(email, '@', 1) AS username, email, password_hash, role, first_name, last_name, is_active, cod_empresa
                 FROM users
                 WHERE is_active = true
                   AND (
                     LOWER(split_part(email, '@', 1)) = $1
                     OR LOWER(email) = $1
                   )
                 LIMIT 1`,
                [identifier]
            );
        
        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        const user = result.rows[0];
        
        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: 'Credenciales inválidas' });
        }
        
        // Generar token JWT
        const normalizedUser = buildUserResponse(user);
        const token = jwt.sign(
            {
                userId: user.id,
                email: normalizedUser.email,
                username: normalizedUser.username,
                role: normalizedUser.role,
                cod_empresa: normalizedUser.cod_empresa,
            },
            process.env.JWT_SECRET || 'credia_jwt_secret_key_2024_super_segura',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({ 
            message: 'Login exitoso',
            token,
            user: normalizedUser
        });
    } catch (error) {
        if (error?.code === 'DEMO_ACCESS_EXPIRED') {
            return res.status(403).json({ message: error.message, code: error.code });
        }
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Obtener perfil de usuario
export const getProfile = async (req, res) => {
    try {
        const authSource = await resolveAuthSource();
        const result = authSource === 'us.usuarios'
            ? await query(
                `SELECT id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, activo AS is_active, cod_empresa, creado_en AS created_at
                 FROM us.usuarios
                 WHERE id = $1`,
                [req.userId]
            )
            : await query(
                "SELECT id, email, split_part(email, '@', 1) AS username, first_name, last_name, role, is_active, cod_empresa, created_at FROM users WHERE id = $1",
                [req.userId]
            );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.json({ user: buildUserResponse(result.rows[0]) });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const authSource = await resolveAuthSource();

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'La clave actual y la nueva clave son requeridas' });
        }

        if (String(newPassword).length < 6) {
            return res.status(400).json({ message: 'La nueva clave debe tener al menos 6 caracteres' });
        }

        const result = authSource === 'us.usuarios'
            ? await query(
                `SELECT id, password_hash
                 FROM us.usuarios
                 WHERE id = $1
                   AND activo = true
                 LIMIT 1`,
                [req.userId]
            )
            : await query(
                `SELECT id, password_hash
                 FROM users
                 WHERE id = $1
                   AND is_active = true
                 LIMIT 1`,
                [req.userId]
            );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!validPassword) {
            return res.status(400).json({ message: 'La clave actual no coincide' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        if (authSource === 'us.usuarios') {
            await query(
                `UPDATE us.usuarios
                 SET password_hash = $1,
                     actualizado_en = NOW()
                 WHERE id = $2`,
                [hashedPassword, req.userId]
            );
        } else {
            await query(
                `UPDATE users
                 SET password_hash = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [hashedPassword, req.userId]
            );
        }

        res.json({ message: 'Clave actualizada correctamente' });
    } catch (error) {
        console.error('Error cambiando clave:', error);
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

// Middleware para verificar token
export const verifyToken = async (req, res, next) => {
    try {
        ensureDemoAccess();

        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ message: 'Acceso denegado - No se proporcionó token' });
        }
        
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'Acceso denegado - Token no válido' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'credia_jwt_secret_key_2024_super_segura');
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userUsername = decoded.username || decoded.email?.split('@')[0];
        req.userRole = normalizeRoleForClient(decoded.role);
        req.cod_empresa = decoded.cod_empresa || 'MAIN';
        next();
    } catch (error) {
        if (error?.code === 'DEMO_ACCESS_EXPIRED') {
            return res.status(401).json({ message: error.message, code: error.code });
        }
        console.error('Error verificando token:', error);
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

// NO exportes default, solo exporta las funciones individualmente
// NO incluyas router ni export default router
