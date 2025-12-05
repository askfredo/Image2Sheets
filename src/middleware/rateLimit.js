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

/**
 * Almacén en memoria para rate limiting de invitados por IP
 * En producción, usar Redis
 */
const guestRateLimits = new Map();

// Limpiar registros antiguos cada hora
setInterval(() => {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [ip, data] of guestRateLimits.entries()) {
    if (data.resetTime < oneDayAgo) {
      guestRateLimits.delete(ip);
    }
  }
}, 60 * 60 * 1000); // cada hora

/**
 * Middleware para limitar extracciones de invitados por IP
 * Límite: 3 extracciones por día por IP
 */
export const checkGuestRateLimit = (req, res, next) => {
  try {
    // Obtener IP del cliente
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               'unknown';

    const GUEST_DAILY_LIMIT = 3;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Obtener o crear registro para esta IP
    let ipData = guestRateLimits.get(ip);

    if (!ipData || (now - ipData.resetTime) > oneDayMs) {
      // Crear nuevo registro o resetear
      ipData = {
        count: 0,
        resetTime: now
      };
      guestRateLimits.set(ip, ipData);
    }

    // Verificar límite
    if (ipData.count >= GUEST_DAILY_LIMIT) {
      const hoursUntilReset = Math.ceil((oneDayMs - (now - ipData.resetTime)) / (60 * 60 * 1000));
      return res.status(429).json({
        success: false,
        message: `Guest limit reached. Try again in ${hoursUntilReset} hours or sign in for more extractions.`,
        error: 'GUEST_LIMIT_REACHED',
        guestUsage: {
          current: ipData.count,
          limit: GUEST_DAILY_LIMIT,
          remaining: 0,
          hoursUntilReset
        }
      });
    }

    // Adjuntar info al request
    req.guestIp = ip;
    req.guestUsage = {
      current: ipData.count,
      limit: GUEST_DAILY_LIMIT,
      remaining: GUEST_DAILY_LIMIT - ipData.count
    };

    next();
  } catch (error) {
    console.error('❌ Error en checkGuestRateLimit:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar límite de invitado'
    });
  }
};

/**
 * Incrementar contador de invitado después de extracción exitosa
 */
export const incrementGuestCount = (req, res, next) => {
  try {
    const ip = req.guestIp;
    if (ip) {
      const ipData = guestRateLimits.get(ip);
      if (ipData) {
        ipData.count += 1;
        guestRateLimits.set(ip, ipData);
      }
    }
    next();
  } catch (error) {
    console.error('❌ Error en incrementGuestCount:', error);
    next(); // No bloquear por error aquí
  }
};

export default {
  checkExtractionLimit,
  incrementExtractionCount,
  getUsageInfo,
  checkGuestRateLimit,
  incrementGuestCount
};
