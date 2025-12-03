import express from 'express';
import { query } from '../config/database.js';
import { verifyGoogleToken, verifyFirebaseToken, generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/google
 * Autenticación con Google OAuth
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Credencial de Google requerida'
      });
    }

    // Verificar token (intentar primero Firebase, luego Google OAuth)
    let googleUser;
    try {
      // Intentar verificar como token de Firebase (desde app móvil)
      googleUser = await verifyFirebaseToken(credential);
      console.log('✅ Token de Firebase verificado');
    } catch (firebaseError) {
      try {
        // Si falla, intentar como token de Google OAuth (desde web)
        googleUser = await verifyGoogleToken(credential);
        console.log('✅ Token de Google OAuth verificado');
      } catch (googleError) {
        console.error('❌ Error al verificar ambos tipos de token:', { firebaseError, googleError });
        throw new Error('Token inválido');
      }
    }

    // Buscar o crear usuario en la base de datos
    let result = await query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleUser.googleId]
    );

    let user;

    if (result.rows.length === 0) {
      // Crear nuevo usuario
      result = await query(
        `INSERT INTO users (google_id, email, name, picture_url)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [googleUser.googleId, googleUser.email, googleUser.name, googleUser.picture]
      );
      user = result.rows[0];
      console.log('✅ Nuevo usuario creado:', user.email);
    } else {
      // Usuario existente - actualizar información
      result = await query(
        `UPDATE users
         SET name = $1, picture_url = $2, updated_at = NOW()
         WHERE google_id = $3
         RETURNING *`,
        [googleUser.name, googleUser.picture, googleUser.googleId]
      );
      user = result.rows[0];
      console.log('✅ Usuario existente autenticado:', user.email);
    }

    // Verificar si tiene suscripción premium activa
    const premiumCheck = await query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
       AND status = 'active'
       AND (end_date IS NULL OR end_date > NOW())
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    const isPremium = premiumCheck.rows.length > 0 || user.is_premium;

    // Actualizar estado premium si cambió
    if (isPremium !== user.is_premium) {
      await query(
        'UPDATE users SET is_premium = $1 WHERE id = $2',
        [isPremium, user.id]
      );
    }

    // Generar JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isPremium: isPremium
    });

    res.json({
      success: true,
      message: 'Autenticación exitosa',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture_url,
        isPremium: isPremium,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error en /auth/google:', error);
    res.status(500).json({
      success: false,
      message: 'Error al autenticar con Google',
      error: error.message
    });
  }
});

/**
 * POST /api/auth/verify
 * Verificar y refrescar token JWT
 */
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    // Obtener información actualizada del usuario
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
        END as current_premium
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

    // Actualizar is_premium si cambió
    if (user.current_premium !== user.is_premium) {
      await query(
        'UPDATE users SET is_premium = $1 WHERE id = $2',
        [user.current_premium, user.id]
      );
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture_url,
        isPremium: user.current_premium,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('❌ Error en /auth/verify:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar token',
      error: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión (invalidar token si se implementa blacklist)
 */
router.post('/logout', authenticateToken, (req, res) => {
  // Por ahora solo devolvemos success
  // En el futuro podemos implementar una blacklist de tokens
  res.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  });
});

export default router;
