import { query } from '../db.js';

// Calcular préstamo (antes de crear)
export const calculateLoan = async (req, res) => {
    try {
        const { amount, annualRate, termMonths } = req.body;
        
        // Cálculos
        const monthlyRate = annualRate / 100 / 12;
        
        let monthlyPayment;
        if (monthlyRate === 0) {
            monthlyPayment = amount / termMonths;
        } else {
            monthlyPayment = 
                (amount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                (Math.pow(1 + monthlyRate, termMonths) - 1);
        }
        
        const totalToPay = monthlyPayment * termMonths;
        const totalInterest = totalToPay - amount;
        
        // Generar tabla de amortización completa
        const amortizationTable = [];
        let balance = parseFloat(amount);
        
        for (let i = 1; i <= termMonths; i++) {
            const interest = balance * monthlyRate;
            const principal = monthlyPayment - interest;
            balance -= principal;
            
            // Calcular fecha de vencimiento (aproximadamente)
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + i);
            
            amortizationTable.push({
                paymentNumber: i,
                dueDate: dueDate.toISOString().split('T')[0],
                payment: parseFloat(monthlyPayment.toFixed(2)),
                principal: parseFloat(principal.toFixed(2)),
                interest: parseFloat(interest.toFixed(2)),
                balance: Math.max(0, parseFloat(balance.toFixed(2)))
            });
        }
        
        res.json({
            success: true,
            calculation: {
                loanAmount: parseFloat(amount),
                annualRate: parseFloat(annualRate),
                termMonths: parseInt(termMonths),
                monthlyPayment: parseFloat(monthlyPayment.toFixed(2)),
                totalToPay: parseFloat(totalToPay.toFixed(2)),
                totalInterest: parseFloat(totalInterest.toFixed(2))
            },
            amortizationTable: amortizationTable.slice(0, 12) // Mostrar solo primeros 12 meses
        });
        
    } catch (error) {
        console.error('Error calculando préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el cálculo del préstamo'
        });
    }
};

// Crear nuevo préstamo
export const createLoan = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            clientId,
            amount,
            annualRate,
            termMonths,
            monthlyPayment,
            totalInterest,
            totalToPay,
            loanPurpose,
            guarantors = []
        } = req.body;
        
        // Generar número de préstamo único
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const loanNumber = `PREST-${timestamp}-${random}`;
        
        // Iniciar transacción
        await query('BEGIN');
        
        // 1. Insertar préstamo
        const loanResult = await query(
            `INSERT INTO loans 
             (client_id, user_id, loan_number, amount, annual_rate, term_months, 
              monthly_payment, total_interest, total_to_pay, loan_purpose, status) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') 
             RETURNING id, loan_number, created_at`,
            [clientId, userId, loanNumber, amount, annualRate, termMonths, 
             monthlyPayment, totalInterest, totalToPay, loanPurpose]
        );
        
        const loanId = loanResult.rows[0].id;
        
        // 2. Insertar garantes si existen
        for (const guarantor of guarantors) {
            await query(
                `INSERT INTO guarantors 
                 (loan_id, identification, full_name, relationship, phone) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [loanId, guarantor.identification, guarantor.fullName, 
                 guarantor.relationship, guarantor.phone]
            );
        }
        
        // 3. Generar registros de pagos futuros
        const monthlyRate = annualRate / 100 / 12;
        let balance = parseFloat(amount);
        const today = new Date();
        
        for (let i = 1; i <= termMonths; i++) {
            const interest = balance * monthlyRate;
            const principal = monthlyPayment - interest;
            balance -= principal;
            
            // Calcular fecha de vencimiento
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() + i);
            
            await query(
                `INSERT INTO payments 
                 (loan_id, payment_number, due_date, amount, principal, interest, status) 
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
                [loanId, i, dueDate.toISOString().split('T')[0], 
                 monthlyPayment, principal, interest]
            );
        }
        
        await query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Préstamo creado exitosamente. Pendiente de aprobación.',
            loan: loanResult.rows[0]
        });
        
    } catch (error) {
        await query('ROLLBACK');
        console.error('Error creando préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando el préstamo'
        });
    }
};

// Aprobar préstamo
export const approveLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId; // El aprobador
        const { disbursementDate } = req.body;
        
        const result = await query(
            `UPDATE loans 
             SET status = 'approved', 
                 approved_by = $1, 
                 approved_at = NOW(),
                 disbursement_date = $2
             WHERE id = $3 AND status = 'pending'
             RETURNING id, loan_number, amount`,
            [userId, disbursementDate, id]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Préstamo no encontrado o ya no está pendiente'
            });
        }
        
        res.json({
            success: true,
            message: 'Préstamo aprobado exitosamente',
            loan: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error aprobando préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error aprobando el préstamo'
        });
    }
};

// Obtener todos los préstamos
export const getAllLoans = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = '';
        let params = [];
        let paramCount = 1;
        
        if (status) {
            whereClause = `WHERE l.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        
        const loansResult = await query(
            `SELECT l.*, c.full_name as client_name, c.identification,
                    u.name as advisor_name
             FROM loans l
             JOIN clients c ON l.client_id = c.id
             JOIN users u ON l.user_id = u.id
             ${whereClause}
             ORDER BY l.created_at DESC
             LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) as total FROM loans l ${whereClause}`,
            params
        );
        
        // Estadísticas
        const statsResult = await query(`
            SELECT 
                COUNT(*) as total_loans,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_loans,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_loans,
                SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as total_active_amount,
                SUM(CASE WHEN status = 'active' THEN monthly_payment ELSE 0 END) as total_monthly_collection
            FROM loans
        `);
        
        res.json({
            success: true,
            loans: loansResult.rows,
            stats: statsResult.rows[0],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total)
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo préstamos:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo préstamos'
        });
    }
};

// Obtener detalles de un préstamo
export const getLoanDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Obtener información del préstamo
        const loanResult = await query(
            `SELECT l.*, c.full_name as client_name, c.identification, c.phone, c.email,
                    u.name as advisor_name, u2.name as approved_by_name
             FROM loans l
             JOIN clients c ON l.client_id = c.id
             JOIN users u ON l.user_id = u.id
             LEFT JOIN users u2 ON l.approved_by = u2.id
             WHERE l.id = $1`,
            [id]
        );
        
        if (loanResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Préstamo no encontrado'
            });
        }
        
        // 2. Obtener garantes
        const guarantorsResult = await query(
            `SELECT id, identification, full_name, relationship, phone 
             FROM guarantors 
             WHERE loan_id = $1`,
            [id]
        );
        
        // 3. Obtener pagos
        const paymentsResult = await query(
            `SELECT id, payment_number, due_date, payment_date, amount, 
                    principal, interest, late_fee, status 
             FROM payments 
             WHERE loan_id = $1 
             ORDER BY payment_number`,
            [id]
        );
        
        res.json({
            success: true,
            loan: loanResult.rows[0],
            guarantors: guarantorsResult.rows,
            payments: paymentsResult.rows
        });
        
    } catch (error) {
        console.error('Error obteniendo detalles del préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo detalles del préstamo'
        });
    }
};