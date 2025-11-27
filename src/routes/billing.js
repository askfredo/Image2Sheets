import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/billing/verify-purchase
 * Verificar y activar suscripción premium
 */
router.post('/verify-purchase', authenticateToken, async (req, res) => {
  try {
    const { purchaseToken, productId, orderId } = req.body;

    if (!purchaseToken || !productId) {
      return res.status(400).json({
        success: false,
        message: 'purchaseToken y productId son requeridos'
      });
    }

    // Verificar si el purchase token ya existe
    const existingPurchase = await query(
      'SELECT * FROM subscriptions WHERE purchase_token = $1',
      [purchaseToken]
    );

    if (existingPurchase.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Esta compra ya ha sido registrada',
        subscription: existingPurchase.rows[0]
      });
    }

    // En producción, aquí deberías verificar con Google Play Billing API
    // Por ahora, confiamos en el token del cliente
    // TODO: Implementar verificación real con Google Play Developer API

    // Determinar duración de la suscripción basado en productId
    let endDate;
    const startDate = new Date();

    if (productId.includes('monthly')) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (productId.includes('yearly')) {
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (productId.includes('lifetime')) {
      endDate = null; // Sin fecha de expiración
    } else {
      // Default: 1 mes
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Usar transacción para asegurar consistencia
    const result = await transaction(async (client) => {
      // Insertar suscripción
      const subscriptionResult = await client.query(
        `INSERT INTO subscriptions
         (user_id, product_id, purchase_token, order_id, status, start_date, end_date, auto_renewing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.user.userId,
          productId,
          purchaseToken,
          orderId || null,
          'active',
          startDate,
          endDate,
          !productId.includes('lifetime')
        ]
      );

      // Actualizar estado premium del usuario
      await client.query(
        `UPDATE users
         SET is_premium = true,
             premium_expires_at = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [endDate, req.user.userId]
      );

      return subscriptionResult.rows[0];
    });

    console.log('✅ Suscripción premium activada para usuario:', req.user.userId);

    res.json({
      success: true,
      message: 'Suscripción premium activada exitosamente',
      subscription: {
        id: result.id,
        productId: result.product_id,
        status: result.status,
        startDate: result.start_date,
        endDate: result.end_date,
        autoRenewing: result.auto_renewing
      }
    });

  } catch (error) {
    console.error('❌ Error en /billing/verify-purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar compra',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/subscription
 * Obtener información de suscripción actual
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM subscriptions
       WHERE user_id = $1
       AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        subscription: null,
        isPremium: false
      });
    }

    const subscription = result.rows[0];

    // Verificar si la suscripción ha expirado
    const now = new Date();
    const isExpired = subscription.end_date && new Date(subscription.end_date) < now;

    if (isExpired && subscription.status === 'active') {
      // Marcar como expirada
      await query(
        `UPDATE subscriptions SET status = 'expired' WHERE id = $1`,
        [subscription.id]
      );

      await query(
        `UPDATE users SET is_premium = false WHERE id = $1`,
        [req.user.userId]
      );

      return res.json({
        success: true,
        subscription: { ...subscription, status: 'expired' },
        isPremium: false
      });
    }

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        productId: subscription.product_id,
        status: subscription.status,
        startDate: subscription.start_date,
        endDate: subscription.end_date,
        autoRenewing: subscription.auto_renewing,
        createdAt: subscription.created_at
      },
      isPremium: true
    });

  } catch (error) {
    console.error('❌ Error en /billing/subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener suscripción',
      error: error.message
    });
  }
});

/**
 * POST /api/billing/cancel
 * Cancelar suscripción (marcar como cancelada, sigue activa hasta fecha de expiración)
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `UPDATE subscriptions
       SET status = 'cancelled', auto_renewing = false, updated_at = NOW()
       WHERE user_id = $1
       AND status = 'active'
       RETURNING *`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró suscripción activa'
      });
    }

    console.log('⚠️ Suscripción cancelada para usuario:', req.user.userId);

    res.json({
      success: true,
      message: 'Suscripción cancelada. Seguirás teniendo acceso Premium hasta la fecha de expiración.',
      subscription: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error en /billing/cancel:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar suscripción',
      error: error.message
    });
  }
});

/**
 * GET /api/billing/history
 * Obtener historial de suscripciones
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({
      success: true,
      subscriptions: result.rows
    });

  } catch (error) {
    console.error('❌ Error en /billing/history:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de suscripciones',
      error: error.message
    });
  }
});

export default router;
