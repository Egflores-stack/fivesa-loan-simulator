import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const resolveAuthSource = async () => {
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

// Registrar usuario
export const register = async (req, res) => {
    try {
        const { username, email, password, first_name, last_name, role = 'asesor' } = req.body;
        const authSource = await resolveAuthSource();

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
                `INSERT INTO us.usuarios (usuario, email, password_hash, rol, nombres, apellidos, activo, creado_en, actualizado_en)
                 VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
                 RETURNING id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, activo AS is_active, creado_en AS created_at`,
                [normalizedUsername, email, hashedPassword, role, first_name || '', last_name || '']
            )
            : await query(
                `INSERT INTO users (email, password_hash, first_name, last_name, role, created_at)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 RETURNING id, split_part(email, '@', 1) AS username, email, first_name, last_name, role, is_active, created_at`,
                [email, hashedPassword, first_name || '', last_name || '', role]
            );
        
        const newUser = result.rows[0];
        
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
        const { username, email, password } = req.body;
        const identifier = (username || email || '').trim().toLowerCase();
        const authSource = await resolveAuthSource();

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Usuario y clave son requeridos' });
        }
        
        // Buscar usuario por username con compatibilidad por email
        const result = authSource === 'us.usuarios'
            ? await query(
                `SELECT id, usuario AS username, email, password_hash, rol AS role, nombres AS first_name, apellidos AS last_name, activo AS is_active
                 FROM us.usuarios
                 WHERE activo = true
                   AND (LOWER(usuario) = $1 OR LOWER(email) = $1)
                 LIMIT 1`,
                [identifier]
            )
            : await query(
                `SELECT id, split_part(email, '@', 1) AS username, email, password_hash, role, first_name, last_name, is_active
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
        const derivedUsername = user.username || user.email?.split('@')[0] || '';
        const token = jwt.sign(
            { userId: user.id, email: user.email, username: derivedUsername, role: user.role },
            process.env.JWT_SECRET || 'credia_jwt_secret_key_2024_super_segura',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({ 
            message: 'Login exitoso',
            token,
            user: { 
                id: user.id, 
                email: user.email, 
                username: derivedUsername,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                full_name: `${user.first_name} ${user.last_name}`
            }
        });
    } catch (error) {
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
                `SELECT id, usuario AS username, email, nombres AS first_name, apellidos AS last_name, rol AS role, activo AS is_active, creado_en AS created_at
                 FROM us.usuarios
                 WHERE id = $1`,
                [req.userId]
            )
            : await query(
                "SELECT id, email, split_part(email, '@', 1) AS username, first_name, last_name, role, is_active, created_at FROM users WHERE id = $1",
                [req.userId]
            );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        const user = result.rows[0];
        user.full_name = `${user.first_name} ${user.last_name}`;
        
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Middleware para verificar token
export const verifyToken = async (req, res, next) => {
    try {
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
        req.userRole = decoded.role;
        next();
    } catch (error) {
        console.error('Error verificando token:', error);
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

// NO exportes default, solo exporta las funciones individualmente
// NO incluyas router ni export default router
