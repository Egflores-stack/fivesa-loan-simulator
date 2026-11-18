import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, query, testConnection } from './db.js';
import { changePassword, getJwtSecret, getProfile, login, register, requireAdmin, verifyToken } from './auth.js';
import {
    createUser,
    deleteUser,
    fetchParameters,
    fetchUsers,
    updateParameters,
    updateUser,
} from './controllers/configController.js';

// Importar nuevos controladores
import { 
    registerClient, 
    getAllClients, 
    getClientById, 
    updateClient,
    checkClientExists,
} from './controllers/clientController.js';

import { 
    calculateLoan, 
    createLoan, 
    approveLoan, 
    rejectLoan,
    getAllLoans, 
    getLoanDetails,
    registerInstallmentPayment,
} from './controllers/loanController.js';

import { getDashboardStats } from './controllers/dashboardController.js';

dotenv.config();

try {
    getJwtSecret();
} catch (error) {
    console.error(`❌ Error fatal de configuración: ${error.message}`);
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true,
    })
);
app.use(express.json());

// Probar conexión a la base de datos
testConnection();

// ===== RUTAS PÚBLICAS =====
app.post('/api/auth/register', verifyToken, requireAdmin, register);
app.get('/api/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        console.error('Error en healthcheck:', error);
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});
app.post('/api/auth/login', login);

// ===== RUTAS PROTEGIDAS (requieren token) =====

// Dashboard
app.get('/api/dashboard/stats', verifyToken, getDashboardStats);

// Clientes
app.post('/api/clients', verifyToken, registerClient);
app.get('/api/clients', verifyToken, getAllClients);
app.get('/api/clients/exists', verifyToken, checkClientExists);
app.get('/api/clients/:id', verifyToken, getClientById);
app.put('/api/clients/:id', verifyToken, updateClient);

// Préstamos
app.post('/api/loans/calculate', verifyToken, calculateLoan);
app.post('/api/loans', verifyToken, createLoan);
app.put('/api/loans/:id/approve', verifyToken, approveLoan);
app.put('/api/loans/:id/reject', verifyToken, rejectLoan);
app.get('/api/loans', verifyToken, getAllLoans);
app.get('/api/loans/:id', verifyToken, getLoanDetails);
app.put('/api/loans/:id/installments/:installmentNumber/pay', verifyToken, registerInstallmentPayment);

// Perfil de usuario
app.get('/api/auth/profile', verifyToken, getProfile);
app.post('/api/auth/change-password', verifyToken, changePassword);

// Configuracion
app.get('/api/config/users', verifyToken, fetchUsers);
app.post('/api/config/users', verifyToken, createUser);
app.patch('/api/config/users/:id', verifyToken, updateUser);
app.delete('/api/config/users/:id', verifyToken, deleteUser);
app.get('/api/config/parameters', verifyToken, fetchParameters);
app.put('/api/config/parameters', verifyToken, updateParameters);

// ===== SERVIR FRONTEND ESTÁTICO Y FALLBACK SPA =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = process.env.FRONTEND_DIST_PATH
    ? path.resolve(process.env.FRONTEND_DIST_PATH)
    : path.resolve(__dirname, '../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));
    app.get(/^\/(?!api(\/|$)).*/, (req, res, next) => {
        res.sendFile(frontendIndexPath, (err) => {
            if (err) next(err);
        });
    });
} else {
    app.get('/', (req, res) => {
        res.json({
            message: 'CREDIA - Sistema de Gestión de Préstamos',
            version: '1.0.0',
            status: 'online',
        });
    });
}

// ===== INICIAR SERVIDOR =====
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor CREDIA corriendo en http://localhost:${PORT}`);
    console.log(`📊 Sistema de Gestión de Préstamos`);
    console.log(`👉 Prueba el login: POST http://localhost:${PORT}/api/auth/login`);
});


const gracefulShutdown = (signal) => {
    console.log(`🛑 Señal ${signal} recibida. Cerrando servidor y pool de PostgreSQL...`);
    server.close(async () => {
        try {
            await pool.end();
            console.log('✅ Pool de PostgreSQL cerrado correctamente.');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error cerrando pool de PostgreSQL:', error);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
