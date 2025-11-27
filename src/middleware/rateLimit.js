import { query } from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_EXTRACTIONS) || 5;

/**
 * Middleware para verificar límite de extracciones diarias (usuarios gratuitos)
 */
export const checkExtractionLimit = async (req, res, next) => {
  try {
    // Si es premium, no hay límite
    if (req.user && req.user.isPremium) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }

    // Obtener información del usuario
    const result = await query(
      'SELECT daily_extractions_count, last_extraction_reset FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = result.rows[0];
    const now = new Date();
    const lastReset = new Date(user.last_extraction_reset);

    // Verificar si necesitamos resetear el contador (ha pasado un día)
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

    let currentCount = user.daily_extractions_count;

    if (hoursSinceReset >= 24) {
      // Resetear contador
      await query(
        'UPDATE users SET daily_extractions_count = 0, last_extraction_reset = NOW() WHERE id = $1',
        [req.user.userId]
      );
      currentCount = 0;
    }

    // Verificar si ha excedido el límite
    if (currentCount >= FREE_DAILY_LIMIT) {
      const hoursUntilReset = Math.ceil(24 - hoursSinceReset);
      return res.status(429).json({
        success: false,
        message: `Has alcanzado el límite diario de ${FREE_DAILY_LIMIT} extracciones`,
        limitReached: true,
        current: currentCount,
        limit: FREE_DAILY_LIMIT,
        hoursUntilReset,
        upgradeRequired: true
      });
    }

    // Pasar información al siguiente middleware
    req.extractionCount = currentCount;
    req.extractionLimit = FREE_DAILY_LIMIT;

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
 */
export const incrementExtractionCount = async (req, res, next) => {
  try {
    // Solo incrementar para usuarios gratuitos
    if (req.user && !req.user.isPremium) {
      await query(
        'UPDATE users SET daily_extractions_count = daily_extractions_count + 1 WHERE id = $1',
        [req.user.userId]
      );
    }
    next();
  } catch (error) {
    console.error('❌ Error en incrementExtractionCount:', error);
    // No fallar la request por esto, solo loguear
    next();
  }
};

/**
 * Obtener información del uso actual del usuario
 */
export const getUsageInfo = async (userId) => {
  try {
    const result = await query(
      `SELECT
        u.daily_extractions_count,
        u.last_extraction_reset,
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
    const now = new Date();
    const lastReset = new Date(user.last_extraction_reset);
    const hoursSinceReset = (now - lastReset) / (1000 * 60 * 60);

    // Si ha pasado un día, el contador actual es 0
    const currentCount = hoursSinceReset >= 24 ? 0 : user.daily_extractions_count;
    const hoursUntilReset = hoursSinceReset >= 24 ? 24 : Math.ceil(24 - hoursSinceReset);

    return {
      isPremium: user.is_premium,
      dailyUsage: {
        current: currentCount,
        limit: user.is_premium ? 'unlimited' : FREE_DAILY_LIMIT,
        remaining: user.is_premium ? 'unlimited' : Math.max(0, FREE_DAILY_LIMIT - currentCount),
        hoursUntilReset
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
