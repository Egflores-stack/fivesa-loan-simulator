import { query } from '../db.js';

// Registrar nuevo cliente
export const registerClient = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            first_name,
            last_name,
            email,
            phone,
            dpi,
            birth_date,
            address,
            employment_status = 'employed',
            monthly_income
        } = req.body;

        // Validar que el DPI no exista
        const existingDPI = await query(
            'SELECT id FROM clients WHERE dpi = $1',
            [dpi]
        );

        if (existingDPI.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un cliente con este número de DPI'
            });
        }

        // Validar que el email no exista (si se proporciona)
        if (email) {
            const existingEmail = await query(
                'SELECT id FROM clients WHERE email = $1',
                [email]
            );

            if (existingEmail.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con este email'
                });
            }
        }

        const result = await query(
            `INSERT INTO clients 
             (first_name, last_name, email, phone, dpi, birth_date, address, 
              employment_status, monthly_income, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
             RETURNING id, first_name, last_name, email, phone, dpi, created_at`,
            [first_name, last_name, email, phone, dpi, birth_date, address, 
             employment_status, monthly_income, userId]
        );

        const client = result.rows[0];
        client.full_name = `${client.first_name} ${client.last_name}`;

        res.status(201).json({
            success: true,
            message: 'Cliente registrado exitosamente',
            client
        });

    } catch (error) {
        console.error('Error registrando cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error registrando cliente',
            error: error.message
        });
    }
};

// Obtener todos los clientes
export const getAllClients = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramCount = 1;
        
        if (search) {
            whereClause += ` AND (first_name ILIKE $${paramCount} OR 
                              last_name ILIKE $${paramCount} OR 
                              email ILIKE $${paramCount} OR 
                              dpi ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        const clientsResult = await query(
            `SELECT id, first_name, last_name, email, phone, dpi, birth_date,
                    address, employment_status, monthly_income, created_at,
                    (first_name || ' ' || last_name) as full_name
             FROM clients 
             ${whereClause}
             ORDER BY created_at DESC 
             LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
            [...params, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as total FROM clients ${whereClause}`,
            params
        );

        res.json({
            success: true,
            clients: clientsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total)
            }
        });

    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo clientes',
            error: error.message
        });
    }
};

// Obtener cliente por ID
export const getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `SELECT c.*, 
                    u.first_name || ' ' || u.last_name as created_by_name
             FROM clients c 
             LEFT JOIN users u ON c.created_by = u.id 
             WHERE c.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        const client = result.rows[0];
        client.full_name = `${client.first_name} ${client.last_name}`;

        // Obtener préstamos del cliente
        const loansResult = await query(
            `SELECT id, loan_type, amount_requested, amount_approved, term_months, 
                    annual_interest_rate, monthly_payment, status, created_at,
                    approval_date
             FROM loans 
             WHERE client_id = $1 
             ORDER BY created_at DESC`,
            [id]
        );

        // Calcular estadísticas de préstamos
        const loanStats = await query(
            `SELECT 
                COUNT(*) as total_loans,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_loans,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_loans,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_approved END), 0) as total_approved_amount
             FROM loans 
             WHERE client_id = $1`,
            [id]
        );

        res.json({
            success: true,
            client,
            loans: loansResult.rows,
            loanStats: loanStats.rows[0]
        });

    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo cliente',
            error: error.message
        });
    }
};

// Actualizar cliente
export const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Construir SET dinámicamente
        const setClause = [];
        const values = [];
        let paramCount = 1;

        // Campos permitidos para actualizar
        const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'dpi', 
                              'birth_date', 'address', 'employment_status', 'monthly_income'];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClause.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        }

        if (setClause.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay datos válidos para actualizar'
            });
        }

        values.push(id); // Para el WHERE
        setClause.push('updated_at = NOW()'); // Actualizar timestamp

        const result = await query(
            `UPDATE clients SET ${setClause.join(', ')} 
             WHERE id = $${paramCount} 
             RETURNING id, first_name, last_name, email, phone, dpi, updated_at`,
            values
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        const client = result.rows[0];
        client.full_name = `${client.first_name} ${client.last_name}`;

        res.json({
            success: true,
            message: 'Cliente actualizado exitosamente',
            client
        });

    } catch (error) {
        console.error('Error actualizando cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error actualizando cliente',
            error: error.message
        });
    }
};