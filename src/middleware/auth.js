import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Inicializar Firebase Admin (solo si no está inicializado)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'image2sheets'
  });
}

/**
 * Middleware para verificar JWT token
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      req.user = user; // { userId, email, isPremium }
      next();
    });
  } catch (error) {
    console.error('❌ Error en authenticateToken:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar token'
    });
  }
};

/**
 * Middleware para verificar que el usuario es Premium
 */
export const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticación requerida'
    });
  }

  if (!req.user.isPremium) {
    return res.status(403).json({
      success: false,
      message: 'Esta funcionalidad requiere una suscripción Premium',
      upgradeRequired: true
    });
  }

  next();
};

/**
 * Verifica un token de Firebase ID
 * @param {string} token - Token de Firebase
 * @returns {Promise<Object>} - Payload del token
 */
export const verifyFirebaseToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      googleId: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Usuario',
      picture: decodedToken.picture || null,
      emailVerified: decodedToken.email_verified
    };
  } catch (error) {
    console.error('❌ Error al verificar token de Firebase:', error);
    throw new Error('Token de Firebase inválido');
  }
};

/**
 * Verifica un token de Google OAuth
 * @param {string} token - Token de Google
 * @returns {Promise<Object>} - Payload del token
 */
export const verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    console.error('❌ Error al verificar token de Google:', error);
    throw new Error('Token de Google inválido');
  }
};

/**
 * Genera un JWT token
 * @param {Object} payload - Datos del usuario
 * @returns {string} - JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

/**
 * Middleware opcional: permite acceso sin autenticación pero adjunta usuario si está presente
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        req.user = null;
      } else {
        req.user = user;
      }
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

export default {
  authenticateToken,
  requirePremium,
  verifyGoogleToken,
  verifyFirebaseToken,
  generateToken,
  optionalAuth
};
