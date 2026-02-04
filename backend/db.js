import pg from "pg";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const poolConfig = {
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  // Forzar conexión simple para evitar problemas de autenticación
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

console.log('🔧 Configuración de base de datos:', {
  host: poolConfig.host,
  port: poolConfig.port,
  database: poolConfig.database,
  user: poolConfig.user,
  password: poolConfig.password ? '***CONFIGURADO***' : 'NO CONFIGURADO'
});

export const pool = new Pool(poolConfig);

// Probar conexión
export const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado a PostgreSQL');
        client.release();
        return true;
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error.message);
        return false;
    }
};

// Ejecutar consultas
export const query = (text, params) => pool.query(text, params);


