import fs from 'fs';
import path from 'path';
import { query } from './db.js';

async function setupDatabase() {
    try {
        console.log('🔄 Configurando base de datos...');
        
        // Leer el archivo schema.sql
        const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Dividir el schema en sentencias individuales
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        console.log(`📝 Ejecutando ${statements.length} sentencias SQL...`);
        
        // Ejecutar cada sentencia
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await query(statement);
                    console.log('✅ Sentencia ejecutada correctamente');
                } catch (error) {
                    console.error('❌ Error en sentencia:', error.message);
                    console.log('Sentencia:', statement.substring(0, 100) + '...');
                }
            }
        }
        
        console.log('🎉 Base de datos configurada exitosamente');
        
        // Verificar tablas
        const result = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('📊 Tablas creadas:');
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
    } catch (error) {
        console.error('❌ Error configurando la base de datos:', error);
    }
}

setupDatabase();