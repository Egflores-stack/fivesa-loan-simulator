import { query } from '../db.js';

// Calcular préstamo (endpoint para el simulador)
export const calculateLoan = async (req, res) => {
    try {
        const { 
            amount, 
            downPayment = 0, 
            termMonths, 
            monthlyRate, 
            frequency = 'monthly',
            commissionType = 'percentage',
            commissionValue = 0,
            currency = 'NIO'
        } = req.body;
        
        // Calcular monto efectivo
        const effectiveAmount = parseFloat(amount) - parseFloat(downPayment);
        
        // Calcular tasa según frecuencia
        let rate, periodsPerYear;
        switch (frequency) {
            case 'weekly':
                rate = monthlyRate / 4.33;
                periodsPerYear = 52;
                break;
            case 'biweekly':
                rate = monthlyRate / 2;
                periodsPerYear = 26;
                break;
            case 'monthly':
                rate = monthlyRate;
                periodsPerYear = 12;
                break;
            case 'quarterly':
                rate = monthlyRate * 3;
                periodsPerYear = 4;
                break;
            default:
                rate = monthlyRate;
                periodsPerYear = 12;
        }
        
        // Calcular cuota
        let payment;
        if (rate === 0) {
            payment = effectiveAmount / termMonths;
        } else {
            payment = (effectiveAmount * rate * Math.pow(1 + rate, termMonths)) / 
                     (Math.pow(1 + rate, termMonths) - 1);
        }
        
        // Calcular comisión
        let commission;
        if (commissionType === 'percentage') {
            commission = effectiveAmount * (commissionValue / 100);
        } else {
            commission = commissionValue;
        }
        
        // Calcular totales
        const totalPayments = payment * termMonths;
        const totalInterest = totalPayments - effectiveAmount;
        const totalCommission = commission;
        const totalCost = totalInterest + totalCommission;
        
        res.json({
            success: true,
            calculation: {
                amount: parseFloat(amount),
                downPayment: parseFloat(downPayment),
                effectiveAmount,
                termMonths,
                monthlyRate,
                frequency,
                commissionType,
                commissionValue,
                currency,
                payment: parseFloat(payment.toFixed(2)),
                totalPayments: parseFloat(totalPayments.toFixed(2)),
                totalInterest: parseFloat(totalInterest.toFixed(2)),
                totalCommission: parseFloat(totalCommission.toFixed(2)),
                totalCost: parseFloat(totalCost.toFixed(2)),
                annualRate: (monthlyRate * 12).toFixed(2)
            }
        });
        
    } catch (error) {
        console.error('Error calculando préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el cálculo del préstamo',
            error: error.message
        });
    }
};

// Crear nueva solicitud de préstamo
export const createLoan = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            clientId,
            loanType,
            amountRequested,
            downPayment = 0,
            termMonths,
            annualInterestRate,
            monthlyPayment,
            commissionType = 'percentage',
            commissionValue = 0,
            paymentFrequency = 'monthly',
            currency = 'NIO',
            purpose
        } = req.body;
        
        // Calcular monto aprobado (por ahora igual al solicitado)
        const amountApproved = parseFloat(amountRequested) - parseFloat(downPayment);
        
        // Iniciar transacción
        await query('BEGIN');
        
        // 1. Insertar préstamo
        const loanResult = await query(
            `INSERT INTO loans 
             (client_id, created_by, loan_type, amount_requested, amount_approved, down_payment, 
              term_months, annual_interest_rate, monthly_payment, commission_type, commission_value,
              payment_frequency, currency, status, purpose, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', $14, NOW()) 
             RETURNING id, created_at`,
            [clientId, userId, loanType, amountRequested, amountApproved, downPayment, 
             termMonths, annualInterestRate, monthlyPayment, commissionType, commissionValue,
             paymentFrequency, currency, purpose]
        );
        
        const loanId = loanResult.rows[0].id;
        
        // 2. Generar tabla de amortización
        const monthlyRate = annualInterestRate / 100 / 12;
        let balance = amountApproved;
        const today = new Date();
        
        for (let i = 1; i <= termMonths; i++) {
            const interest = balance * monthlyRate;
            const principal = monthlyPayment - interest;
            balance -= principal;
            
            // Calcular fecha de vencimiento según frecuencia
            let dueDate = new Date(today);
            switch (paymentFrequency) {
                case 'weekly':
                    dueDate.setDate(dueDate.getDate() + (i * 7));
                    break;
                case 'biweekly':
                    dueDate.setDate(dueDate.getDate() + (i * 14));
                    break;
                case 'monthly':
                    dueDate.setMonth(dueDate.getMonth() + i);
                    break;
                case 'quarterly':
                    dueDate.setMonth(dueDate.getMonth() + (i * 3));
                    break;
            }
            
            // Calcular monto de comisión
            let commissionAmount = 0;
            if (commissionType === 'percentage') {
                commissionAmount = principal * (commissionValue / 100);
            } else {
                commissionAmount = commissionValue / termMonths;
            }
            
            await query(
                `INSERT INTO loan_payments 
                 (loan_id, payment_number, due_date, principal_amount, interest_amount, 
                  commission_amount, total_amount, balance_after_payment, status, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())`,
                [loanId, i, dueDate.toISOString().split('T')[0], 
                 principal, interest, commissionAmount, monthlyPayment, Math.max(0, balance)]
            );
        }
        
        await query('COMMIT');
        
        res.status(201).json({
            success: true,
            message: 'Solicitud de préstamo creada exitosamente. Pendiente de aprobación.',
            loan: {
                id: loanId,
                client_id: clientId,
                amount_requested: amountRequested,
                amount_approved: amountApproved,
                status: 'pending',
                created_at: loanResult.rows[0].created_at
            }
        });
        
    } catch (error) {
        await query('ROLLBACK');
        console.error('Error creando préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error creando la solicitud de préstamo',
            error: error.message
        });
    }
};

// Aprobar préstamo
export const approveLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const { amountApproved } = req.body;
        
        const result = await query(
            `UPDATE loans 
             SET status = 'approved', 
                 amount_approved = $1,
                 approval_date = NOW()
             WHERE id = $2 AND status = 'pending'
             RETURNING id, client_id, amount_approved, approval_date`,
            [amountApproved, id]
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
            message: 'Error aprobando el préstamo',
            error: error.message
        });
    }
};

// Obtener todos los préstamos
export const getAllLoans = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramCount = 1;
        
        if (status) {
            whereClause += ` AND l.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }
        
        const loansResult = await query(
            `SELECT l.*, 
                    c.first_name || ' ' || c.last_name as client_name, 
                    c.email,
                    u.first_name || ' ' || u.last_name as advisor_name
             FROM loans l
             JOIN clients c ON l.client_id = c.id
             JOIN users u ON l.created_by = u.id
             ${whereClause}
             ORDER BY l.created_at DESC
             LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
            [...params, limit, offset]
        );
        
        const countResult = await query(
            `SELECT COUNT(*) as total FROM loans l ${whereClause}`,
            params
        );
        
        res.json({
            success: true,
            loans: loansResult.rows,
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
            message: 'Error obteniendo préstamos',
            error: error.message
        });
    }
};

// Obtener detalles de un préstamo
export const getLoanDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Obtener información del préstamo
        const loanResult = await query(
            `SELECT l.*, 
                    c.first_name || ' ' || c.last_name as client_name, 
                    c.email, c.phone,
                    u.first_name || ' ' || u.last_name as advisor_name
             FROM loans l
             JOIN clients c ON l.client_id = c.id
             JOIN users u ON l.created_by = u.id
             WHERE l.id = $1`,
            [id]
        );
        
        if (loanResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Préstamo no encontrado'
            });
        }
        
        // 2. Obtener tabla de amortización
        const paymentsResult = await query(
            `SELECT payment_number, due_date, principal_amount, interest_amount, 
                    commission_amount, total_amount, balance_after_payment, status, paid_date
             FROM loan_payments 
             WHERE loan_id = $1 
             ORDER BY payment_number`,
            [id]
        );
        
        res.json({
            success: true,
            loan: loanResult.rows[0],
            payments: paymentsResult.rows
        });
        
    } catch (error) {
        console.error('Error obteniendo detalles del préstamo:', error);
        res.status(500).json({
            success: false,
            message: 'Error obteniendo detalles del préstamo',
            error: error.message
        });
    }
};