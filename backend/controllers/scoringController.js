import { query } from '../db.js';

/**
 * scoringController.js
 * External Scoring Integration for Kora
 */

const round2 = (value) => Number(Number(value).toFixed(2));

/**
 * POST /api/scoring/kora-recommendation
 * Receives sales data from Kora and returns a credit recommendation
 */
export const getKoraRecommendation = async (req, res) => {
  try {
    const { salesData, inventoryValue } = req.body;
    const cod_empresa = req.cod_empresa;

    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sales data is required and must be a non-empty array'
      });
    }

    // 1. Calculate Inventory Turnover (Rotacion de Inventario)
    // Turnover = Cost of Goods Sold / Average Inventory
    // Here we use simplified: Total Sales / Inventory Value
    const totalSales = salesData.reduce((acc, sale) => acc + (sale.amount || 0), 0);
    const avgMonthlySales = totalSales / (salesData.length || 1);

    let turnoverRatio = 0;
    if (inventoryValue && inventoryValue > 0) {
      turnoverRatio = totalSales / inventoryValue;
    } else {
      // Fallback if no inventory value provided: assume a standard ratio based on monthly sales
      turnoverRatio = 2.5;
    }

    // 2. Determine Credit Recommendation
    // High turnover (> 4) -> 3x monthly sales
    // Medium turnover (2-4) -> 1.5x monthly sales
    // Low turnover (< 2) -> 0.8x monthly sales

    let multiplier = 0.8;
    if (turnoverRatio > 4) multiplier = 3.0;
    else if (turnoverRatio >= 2) multiplier = 1.5;

    const recommendedAmount = round2(avgMonthlySales * multiplier);

    // 3. Log the scoring request (Audit)
    await query(
      `INSERT INTO saas.audit_logs (cod_empresa, usuario_id, accion, entidad, entidad_id, detalles)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        cod_empresa,
        req.userId,
        'SCORING_CALCULATION',
        'KORA_INTEGRATION',
        null,
        JSON.stringify({
          totalSales,
          turnoverRatio,
          multiplier,
          recommendedAmount,
          salesCount: salesData.length
        })
      ]
    ).catch(err => console.error('Failed to log scoring audit:', err.message));

    res.json({
      success: true,
      scoring: {
        totalSales: round2(totalSales),
        avgMonthlySales: round2(avgMonthlySales),
        turnoverRatio: round2(turnoverRatio),
        multiplier,
        recommendedAmount,
        currency: 'NIO'
      }
    });

  } catch (error) {
    console.error('Error in Kora Scoring:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during scoring calculation',
      error: error.message
    });
  }
};
