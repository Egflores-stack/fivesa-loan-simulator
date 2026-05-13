import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { testConnection } from './db.js';
import { changePassword, getProfile, login, register, verifyToken } from './auth.js';
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

import {
    uploadDocumentMetadata,
    getClientDocuments,
    deleteDocument
} from './controllers/documentController.js';

import { getRiskMetrics } from './controllers/riskController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Probar conexión a la base de datos
testConnection();

// ===== RUTAS PÚBLICAS =====
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// ===== RUTAS PROTEGIDAS (requieren token) =====

// Dashboard
app.get('/api/dashboard/stats', verifyToken, getDashboardStats);
app.get('/api/dashboard/risk', verifyToken, getRiskMetrics);

// Clientes
app.post('/api/clients', verifyToken, registerClient);
app.get('/api/clients', verifyToken, getAllClients);
app.get('/api/clients/exists', verifyToken, checkClientExists);
app.get('/api/clients/:id', verifyToken, getClientById);
app.put('/api/clients/:id', verifyToken, updateClient);
app.get('/api/clients/:cliente_id/documents', verifyToken, getClientDocuments);
app.post('/api/documents', verifyToken, uploadDocumentMetadata);
app.delete('/api/documents/:id', verifyToken, deleteDocument);

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

// ===== RUTA DE PRUEBA =====
app.get('/', (req, res) => {
    res.json({ 
        message: 'CREDIA - Sistema de Gestión de Préstamos',
        version: '1.0.0',
        status: 'online',
        endpoints: {
            auth: ['/api/auth/register', '/api/auth/login'],
            dashboard: ['/api/dashboard/stats'],
            clients: ['/api/clients', '/api/clients/:id'],
            loans: ['/api/loans', '/api/loans/:id', '/api/loans/calculate']
        }
    });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
    console.log(`🚀 Servidor CREDIA corriendo en http://localhost:${PORT}`);
    console.log(`📊 Sistema de Gestión de Préstamos`);
    console.log(`👉 Prueba el login: POST http://localhost:${PORT}/api/auth/login`);
});
