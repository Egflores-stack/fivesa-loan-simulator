import { query } from '../db.js';

export const getRiskMetrics = async (req, res) => {
  try {
    const cod_empresa = req.cod_empresa;

    // 1. Portfolio Health (Estado de Cartera)
    // Sana: No payments overdue
    // En Riesgo: Overdue < 30 days
    // Vencida: Overdue > 30 days
    const healthResult = await query(
      `WITH DPD_Calculation AS (
          SELECT
            c.id as credito_id,
            c.monto_solicitado,
            COALESCE(MAX(CASE WHEN a.estado = 'PENDIENTE' AND a.fecha_vencimiento < CURRENT_DATE THEN CURRENT_DATE - a.fecha_vencimiento ELSE 0 END), 0) as max_dpd
          FROM op.creditos c
          LEFT JOIN op.amortizaciones a ON c.id = a.credito_id
          WHERE c.cod_empresa = $1
          GROUP BY c.id, c.monto_solicitado
       )
       SELECT
          CASE
            WHEN max_dpd = 0 THEN 'Sana'
            WHEN max_dpd <= 30 THEN 'En Riesgo'
            ELSE 'Vencida'
          END as estado,
          COUNT(*)::int as cantidad,
          SUM(monto_solicitado) as monto_total
       FROM DPD_Calculation
       GROUP BY 1`,
       [cod_empresa]
    );

    // 2. Projected Delinquency (Mora Proyectada)
    // Total amount that will fall due in the next 30 days
    const projectionResult = await query(
      `SELECT
        SUM(cuota_total) as monto_proyectado_30_dias,
        COUNT(*)::int as cuotas_proyectadas
       FROM op.amortizaciones
       WHERE cod_empresa = $1
         AND estado = 'PENDIENTE'
         AND fecha_vencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')`,
      [cod_empresa]
    );

    // 3. Top Risk Clients
    const riskyClients = await query(
      `SELECT
        cl.id,
        (cl.nombres || ' ' || cl.apellidos) as full_name,
        cr.id as loan_id,
        cr.monto_solicitado,
        MAX(CURRENT_DATE - am.fecha_vencimiento) as dpd
       FROM cl.clientes cl
       JOIN op.creditos cr ON cl.id = cr.cliente_id
       JOIN op.amortizaciones am ON cr.id = am.credito_id
       WHERE cr.cod_empresa = $1 AND am.estado = 'PENDIENTE' AND am.fecha_vencimiento < CURRENT_DATE
       GROUP BY cl.id, cr.id
       ORDER BY dpd DESC
       LIMIT 5`,
       [cod_empresa]
    );

    res.json({
      success: true,
      portfolioHealth: healthResult.rows,
      projectedMora: projectionResult.rows[0],
      riskyClients: riskyClients.rows
    });

  } catch (error) {
    console.error('Error calculando métricas de riesgo:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};
