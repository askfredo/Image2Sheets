import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { getUsageInfo } from '../middleware/rateLimit.js';

const router = express.Router();

/**
 * GET /api/users/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.user_id = u.id
            AND s.status = 'active'
            AND (s.end_date IS NULL OR s.end_date > NOW())
          ) THEN true
          ELSE u.is_premium
        END as current_premium,
        (SELECT COUNT(*) FROM extractions WHERE user_id = u.id) as total_extractions,
        (SELECT s.end_date FROM subscriptions s
         WHERE s.user_id = u.id AND s.status = 'active'
         ORDER BY s.created_at DESC LIMIT 1) as premium_expires_at
       FROM users u
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];

    // Obtener información de uso
    const usage = await getUsageInfo(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture_url,
        isPremium: user.current_premium,
        premiumExpiresAt: user.premium_expires_at,
        createdAt: user.created_at,
        totalExtractions: parseInt(user.total_extractions) || 0
      },
      usage
    });

  } catch (error) {
    console.error('❌ Error en /users/me:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del usuario',
      error: error.message
    });
  }
});

/**
 * GET /api/users/usage
 * Obtener información de uso del usuario
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const usage = await getUsageInfo(req.user.userId);

    if (!usage) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      usage
    });

  } catch (error) {
    console.error('❌ Error en /users/usage:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de uso',
      error: error.message
    });
  }
});

/**
 * PATCH /api/users/me
 * Actualizar información del usuario
 */
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nombre requerido'
      });
    }

    const result = await query(
      `UPDATE users SET name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [name, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture_url,
        isPremium: user.is_premium
      }
    });

  } catch (error) {
    console.error('❌ Error en PATCH /users/me:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
});

/**
 * DELETE /api/users/me
 * Eliminar cuenta del usuario
 */
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    // Eliminar usuario (cascade eliminará extracciones y suscripciones)
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    console.log('🗑️ Usuario eliminado:', result.rows[0].email);

    res.json({
      success: true,
      message: 'Cuenta eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /users/me:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cuenta',
      error: error.message
    });
  }
});

export default router;
