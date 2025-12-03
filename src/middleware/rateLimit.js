import { query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_EXTRACTIONS) || 5;

/**
 * Middleware para verificar límite de extracciones diarias (usuarios gratuitos)
 * DESHABILITADO: Sin límites por ahora
 */
export const checkExtractionLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    // Sin límites - todos los usuarios tienen extracciones ilimitadas
    req.extractionCount = 0;
    req.extractionLimit = 'unlimited';

    next();
  } catch (error) {
    console.error('❌ Error en checkExtractionLimit:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar límite de extracciones'
    });
  }
};

/**
 * Middleware para incrementar el contador de extracciones después de una extracción exitosa
 * DESHABILITADO: Sin límites por ahora
 */
export const incrementExtractionCount = async (req, res, next) => {
  // Sin límites - no incrementar contador
  next();
};

/**
 * Obtener información del uso actual del usuario
 * MODIFICADO: Todos los usuarios tienen acceso ilimitado
 */
export const getUsageInfo = async (userId) => {
  try {
    const result = await query(
      `SELECT
        u.is_premium,
        COUNT(e.id) as total_extractions
      FROM users u
      LEFT JOIN extractions e ON e.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    return {
      isPremium: user.is_premium,
      dailyUsage: {
        current: 0,
        limit: 'unlimited',
        remaining: 'unlimited',
        hoursUntilReset: 0
      },
      totalExtractions: parseInt(user.total_extractions) || 0
    };
  } catch (error) {
    console.error('❌ Error en getUsageInfo:', error);
    throw error;
  }
};

export default {
  checkExtractionLimit,
  incrementExtractionCount,
  getUsageInfo
};
