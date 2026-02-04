import { query } from '../db.js';

// Obtener estadísticas para el dashboard
export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.userId;
        
        // Estadísticas generales usando la vista dashboard_stats
        const statsResult = await query(`
            SELECT 
                (SELECT COUNT(*) FROM clients) as total_clients,
                (SELECT COUNT(*) FROM clients WHERE created_by = $1) as my_clients,
                (SELECT COUNT(*) FROM loans) as total_loans,
                (SELECT COUNT(*) FROM loans WHERE created_by = $1) as my_loans,
                (SELECT COUNT(*) FROM loans WHERE status = 'pending') as pending_loans,
                (SELECT COUNT(*) FROM loans WHERE status = 'approved') as approved_loans,
                (SELECT COUNT(*) FROM loans WHERE status = 'rejected') as rejected_loans,
                (SELECT COUNT(*) FROM loans WHERE status = 'active') as active_loans,
                (SELECT COALESCE(SUM(amount_approved), 0) FROM loans WHERE status = 'approved') as total_approved_amount,
                (SELECT COALESCE(AVG(amount_approved), 0) FROM loans WHERE status = 'approved' AND amount_approved > 0) as avg_loan_amount,
                (SELECT COUNT(*) FROM loan_payments WHERE status = 'pending' AND due_date < CURRENT_DATE) as overdue_payments
        `, [userId]);
        
        // Préstamos por mes (últimos 6 meses)
        const monthlyLoansResult = await query(`
            SELECT 
                TO_CHAR(created_at, 'Mon') as month,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as aprobados,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rechazados,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pendientes
            FROM loans 
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
            LIMIT 6
        `);

        // Distribución por tipo de préstamo
        const loanTypesResult = await query(`
            SELECT 
                loan_type,
                COUNT(*) as count,
                COALESCE(SUM(amount_approved), 0) as total_amount
            FROM loans 
            WHERE status = 'approved'
            GROUP BY loan_type
        `);

        // Calcular porcentajes para distribución
        const totalApproved = loanTypesResult.rows.reduce((sum, row) => sum + Number(row.count), 0);
        const loanDistribution = loanTypesResult.rows.map(row => ({
            name: translateLoanType(row.loan_type),
            value: totalApproved > 0 ? Math.round((Number(row.count) / totalApproved) * 100) : 0,
            count: Number(row.count),
            total_amount: Number(row.total_amount),
            color: getLoanTypeColor(row.loan_type)
        }));

        // Préstamos recientes
        const recentLoansResult = await query(`
            SELECT l.id, l.amount_requested, l.status, l.created_at, l.loan_type,
                   c.first_name, c.last_name, c.email
            FROM loans l
            JOIN clients c ON l.client_id = c.id
            ORDER BY l.created_at DESC
            LIMIT 5
        `);

        const recentLoans = recentLoansResult.rows.map(loan => ({
            id: loan.id,
            cliente: `${loan.first_name} ${loan.last_name}`,
            monto: Number(loan.amount_requested),
            plazo: '36 meses', // placeholder - podrías calcularlo
            fecha: loan.created_at.toISOString().split('T')[0],
            estado: loan.status
        }));

        const stats = statsResult.rows[0];
        const approvalRate = Number(stats.total_loans) > 0 
            ? Math.round((Number(stats.approved_loans) / Number(stats.total_loans)) * 100) 
            : 0;

        res.json({
            statsCards: [
                { 
                    title: 'Total Solicitudes', 
                    value: stats.total_loans.toString(), 
                    icon: 'FileText', 
                    change: '+12%', 
                    color: 'blue' 
                },
                { 
                    title: 'Clientes Activos', 
                    value: stats.total_clients.toString(), 
                    icon: 'Users', 
                    change: '+5%', 
                    color: 'green' 
                },
                { 
                    title: 'Monto Total', 
                    value: formatCurrency(Number(stats.total_approved_amount)), 
                    icon: 'DollarSign', 
                    change: '+18%', 
                    color: 'purple' 
                },
                { 
                    title: 'Tasa Aprobación', 
                    value: `${approvalRate}%`, 
                    icon: 'TrendingUp', 
                    change: '+3%', 
                    color: 'orange' 
                }
            ],
            loanRequestsData: monthlyLoansResult.rows,
            loanAmountsData: loanDistribution,
            recentRequests: recentLoans,
            loanRequestsData: monthlyLoansResult.rows.map(row => ({
                month: row.month,
                aprobados: Number(row.aprobados),
                rechazados: Number(row.rechazados),
                pendientes: Number(row.pendientes)
            }))
        });
        
    } catch (error) {
        console.error('Error obteniendo dashboard stats:', error);
        res.status(500).json({
            message: 'Error obteniendo estadísticas del dashboard',
            error: error.message
        });
    }
};

// Funciones auxiliares
function translateLoanType(type) {
    const translations = {
        'personal': 'Personal',
        'hipotecario': 'Hipotecario',
        'automotriz': 'Automotriz',
        'negocios': 'Negocios',
        'educacion': 'Educación'
    };
    return translations[type] || type;
}

function getLoanTypeColor(type) {
    const colors = {
        'personal': '#0088FE',
        'hipotecario': '#00C49F',
        'automotriz': '#FFBB28',
        'negocios': '#FF8042',
        'educacion': '#8884D8'
    };
    return colors[type] || '#8884D8';
}

function formatCurrency(amount) {
    if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
}