import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
    try {
        console.log('🔄 Configurando base de datos...');

        const schemaPath = path.join(__dirname, 'database', 'init.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await query(schemaSql);
        console.log('✅ Esquemas y tablas verificados/creados (init.sql)');

        const adminPassword = String(process.env.ADMIN_INITIAL_PASSWORD || '').trim();
        if (!adminPassword) {
            throw new Error('ADMIN_INITIAL_PASSWORD es obligatorio para crear el usuario administrador inicial');
        }

        const adminEmail = String(process.env.ADMIN_INITIAL_EMAIL || 'admin@credia.local').trim().toLowerCase();
        const adminUsername = String(process.env.ADMIN_INITIAL_USERNAME || 'admin').trim().toLowerCase();

        const existingAdmin = await query(
            `SELECT id, usuario, email
             FROM us.usuarios
             WHERE LOWER(usuario) = LOWER($1) OR LOWER(email) = LOWER($2)
             LIMIT 1`,
            [adminUsername, adminEmail]
        );

        if (existingAdmin.rowCount === 0) {
            const passwordHash = await bcrypt.hash(adminPassword, 10);
            await query(
                `INSERT INTO us.usuarios (usuario, email, password_hash, rol, nombres, apellidos, activo)
                 VALUES ($1, $2, $3, 'Administrador', 'Administrador', 'Sistema', true)`,
                [adminUsername, adminEmail, passwordHash]
            );
            console.log(`✅ Usuario administrador inicial creado: ${adminUsername} (${adminEmail})`);
        } else {
            console.log(`ℹ️ Usuario administrador ya existe (${existingAdmin.rows[0].usuario}); sin cambios.`);
        }

        const tablesResult = await query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema IN ('us', 'cl', 'op', 'pa', 'public')
              AND table_name IN ('usuarios', 'accesos', 'clientes', 'creditos', 'amortizaciones', 'parametros', 'user_admin_profiles')
            ORDER BY table_schema, table_name
        `);

        console.log('📊 Tablas disponibles:');
        tablesResult.rows.forEach((row) => {
            console.log(`  - ${row.table_schema}.${row.table_name}`);
        });
    } catch (error) {
        console.error('❌ Error configurando la base de datos:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

setupDatabase();
