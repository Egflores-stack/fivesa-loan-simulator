import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

// Registrar usuario
export const register = async (req, res) => {
    try {
        const { email, password, first_name, last_name, role = 'asesor' } = req.body;
        
        // Verificar si el usuario ya existe
        const userCheck = await query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }
        
        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insertar usuario
        const result = await query(
            'INSERT INTO users (email, password_hash, first_name, last_name, role, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, email, first_name, last_name, role, is_active, created_at',
            [email, hashedPassword, first_name, last_name, role]
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
        const { email, password } = req.body;
        
        // Buscar usuario
        const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
        
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
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'credia_jwt_secret_key_2024_super_segura',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        res.json({ 
            message: 'Login exitoso',
            token,
            user: { 
                id: user.id, 
                email: user.email, 
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
        const result = await query(
            'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = $1', 
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
        req.userRole = decoded.role;
        next();
    } catch (error) {
        console.error('Error verificando token:', error);
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

// NO exportes default, solo exporta las funciones individualmente
// NO incluyas router ni export default router