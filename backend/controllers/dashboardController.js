import { query } from '../db.js';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

export const getDashboardStats = async (req, res) => {
  try {
    const [totalsResult, monthlyResult, recentResult] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM cl.clientes WHERE activo = true) AS total_clients,
           (SELECT COUNT(*)::int FROM op.creditos) AS total_loans,
           (SELECT COUNT(*)::int FROM op.creditos WHERE estado = 'PENDIENTE') AS pending_loans,
           (SELECT COUNT(*)::int FROM op.creditos WHERE estado = 'APROBADO') AS approved_loans,
           (SELECT COALESCE(SUM(monto_solicitado), 0) FROM op.creditos WHERE estado = 'APROBADO') AS total_approved_amount`
      ),
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', fecha_solicitud), 'Mon') AS month,
           COUNT(*) FILTER (WHERE estado = 'APROBADO')::int AS aprobados,
           COUNT(*) FILTER (WHERE estado = 'RECHAZADO')::int AS rechazados,
           COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes
         FROM op.creditos
         WHERE fecha_solicitud >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', fecha_solicitud)
         ORDER BY DATE_TRUNC('month', fecha_solicitud)`
      ),
      query(
        `SELECT c.id,
                c.monto_solicitado,
                c.plazo_meses,
                c.fecha_solicitud,
                c.estado,
                (cl.nombres || ' ' || cl.apellidos) AS cliente
         FROM op.creditos c
         JOIN cl.clientes cl ON cl.id = c.cliente_id
         ORDER BY c.fecha_solicitud DESC
         LIMIT 8`
      ),
    ]);

    const totals = totalsResult.rows[0] || {};
    const totalLoans = Number(totals.total_loans || 0);
    const approvedLoans = Number(totals.approved_loans || 0);
    const approvalRate = totalLoans > 0 ? Math.round((approvedLoans / totalLoans) * 100) : 0;

    res.json({
      statsCards: [
        { title: 'Total Solicitudes', value: String(totalLoans), icon: 'FileText' },
        { title: 'Clientes Activos', value: String(totals.total_clients || 0), icon: 'Users' },
        {
          title: 'Monto Aprobado',
          value: formatCurrency(totals.total_approved_amount),
          icon: 'DollarSign',
        },
        { title: 'Tasa de Aprobacion', value: `${approvalRate}%`, icon: 'TrendingUp' },
      ],
      loanRequestsData: monthlyResult.rows.map((row) => ({
        month: row.month,
        aprobados: Number(row.aprobados),
        rechazados: Number(row.rechazados),
        pendientes: Number(row.pendientes),
      })),
      recentRequests: recentResult.rows.map((row) => ({
        id: row.id,
        cliente: row.cliente,
        monto: Number(row.monto_solicitado || 0),
        plazo: `${Number(row.plazo_meses || 0)} meses`,
        fecha: new Date(row.fecha_solicitud).toISOString().split('T')[0],
        estado: normalizeStatus(row.estado),
      })),
    });
  } catch (error) {
    console.error('Error obteniendo dashboard stats:', error);
    res.status(500).json({
      message: 'Error obteniendo estadisticas del dashboard',
      error: error.message,
    });
  }
};
