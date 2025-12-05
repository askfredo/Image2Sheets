import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  checkExtractionLimit,
  incrementExtractionCount,
  checkGuestRateLimit,
  incrementGuestCount
} from '../middleware/rateLimit.js';
import {
  extractTable,
  base64ToGeminiPart,
  validateImage,
  analyzeTableQuality,
  tableToMarkdown,
  tableToCSV
} from '../services/gemini.js';

const router = express.Router();

/**
 * POST /api/extractions/extract-guest
 * Extraer tabla de una imagen (modo invitado - sin autenticación)
 * Límite: 3 extracciones por día por IP
 */
router.post('/extract-guest',
  checkGuestRateLimit,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { image, mimeType = 'image/png' } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          message: 'Imagen requerida'
        });
      }

      // Validar imagen
      const validation = validateImage(image);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // Convertir a formato Gemini
      const imagePart = base64ToGeminiPart(image, mimeType);

      // Extraer tabla con Gemini AI
      const tableData = await extractTable(imagePart);

      // Analizar calidad
      const quality = analyzeTableQuality(tableData);

      const processingTime = Date.now() - startTime;

      // Incrementar contador de invitado
      await incrementGuestCount(req, res, () => {});

      // Calcular uso actualizado
      const updatedUsage = {
        current: req.guestUsage.current + 1,
        limit: req.guestUsage.limit,
        remaining: req.guestUsage.remaining - 1
      };

      res.json({
        success: true,
        message: 'Tabla extraída exitosamente (modo invitado)',
        extraction: {
          id: `guest-${Date.now()}`,
          tableData: {
            ...tableData,
            markdown: tableToMarkdown(tableData),
            csv: tableToCSV(tableData),
            rows: tableData.rows.length,
            columns: tableData.headers.length
          },
          quality,
          processingTime,
          createdAt: new Date().toISOString()
        },
        guestMode: true,
        usage: updatedUsage,
        message_upgrade: updatedUsage.remaining === 0
          ? 'Has usado todas tus extracciones de invitado. Inicia sesión para obtener más.'
          : `Te quedan ${updatedUsage.remaining} extracciones de invitado.`
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error('❌ Error en /extractions/extract-guest:', error);
      res.status(500).json({
        success: false,
        message: 'Error al extraer tabla',
        error: error.message,
        guestMode: true
      });
    }
  }
);

/**
 * POST /api/extractions/extract
 * Extraer tabla de una imagen
 */
router.post('/extract',
  authenticateToken,
  checkExtractionLimit,
  async (req, res) => {
    const startTime = Date.now();

    try {
      const { image, mimeType = 'image/png' } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          message: 'Imagen requerida'
        });
      }

      // Validar imagen
      const validation = validateImage(image);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.error
        });
      }

      // Convertir a formato Gemini
      const imagePart = base64ToGeminiPart(image, mimeType);

      // Extraer tabla con Gemini AI
      const tableData = await extractTable(imagePart);

      // Analizar calidad
      const quality = analyzeTableQuality(tableData);

      const processingTime = Date.now() - startTime;

      // Guardar en historial
      const extractionResult = await query(
        `INSERT INTO extractions
         (user_id, module_type, image_data, extracted_data, processing_time_ms, success)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          req.user.userId,
          'table_extraction',
          image.substring(0, 1000), // Guardar solo preview
          JSON.stringify(tableData),
          processingTime,
          true
        ]
      );

      const extraction = extractionResult.rows[0];

      // Incrementar contador para usuarios gratuitos
      await incrementExtractionCount(req, res, () => {});

      res.json({
        success: true,
        message: 'Tabla extraída exitosamente',
        extraction: {
          id: extraction.id,
          tableData: {
            ...tableData,
            markdown: tableToMarkdown(tableData),
            csv: tableToCSV(tableData),
            rows: tableData.rows.length,
            columns: tableData.headers.length
          },
          quality,
          processingTime,
          createdAt: extraction.created_at
        },
        usage: {
          current: req.extractionCount + 1,
          limit: req.extractionLimit || 'unlimited',
          remaining: req.extractionLimit ? req.extractionLimit - req.extractionCount - 1 : 'unlimited'
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Registrar error en la base de datos
      try {
        await query(
          `INSERT INTO extractions
           (user_id, module_type, extracted_data, processing_time_ms, success, error_message)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user.userId,
            'table_extraction',
            '{}',
            processingTime,
            false,
            error.message
          ]
        );
      } catch (dbError) {
        console.error('❌ Error al registrar fallo:', dbError);
      }

      console.error('❌ Error en /extractions/extract:', error);
      res.status(500).json({
        success: false,
        message: 'Error al extraer tabla',
        error: error.message
      });
    }
  }
);

/**
 * GET /api/extractions/history
 * Obtener historial de extracciones del usuario
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, module_type } = req.query;

    let queryText = `
      SELECT
        id,
        module_type,
        extracted_data,
        processing_time_ms,
        success,
        error_message,
        created_at
      FROM extractions
      WHERE user_id = $1
    `;

    const params = [req.user.userId];

    // Filtrar por tipo de módulo si se especifica
    if (module_type) {
      queryText += ` AND module_type = $${params.length + 1}`;
      params.push(module_type);
    }

    // Para usuarios gratuitos, limitar a últimos 7 días
    if (!req.user.isPremium) {
      queryText += ` AND created_at >= NOW() - INTERVAL '7 days'`;
    }

    queryText += `
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Obtener total count
    let countQuery = 'SELECT COUNT(*) FROM extractions WHERE user_id = $1';
    const countParams = [req.user.userId];

    if (module_type) {
      countQuery += ' AND module_type = $2';
      countParams.push(module_type);
    }

    if (!req.user.isPremium) {
      countQuery += ` AND created_at >= NOW() - INTERVAL '7 days'`;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      extractions: result.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    console.error('❌ Error en /extractions/history:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial',
      error: error.message
    });
  }
});

/**
 * GET /api/extractions/:id
 * Obtener una extracción específica
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM extractions
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extracción no encontrada'
      });
    }

    res.json({
      success: true,
      extraction: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error en /extractions/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener extracción',
      error: error.message
    });
  }
});

/**
 * DELETE /api/extractions/:id
 * Eliminar una extracción del historial
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM extractions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Extracción no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Extracción eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en DELETE /extractions/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar extracción',
      error: error.message
    });
  }
});

/**
 * DELETE /api/extractions
 * Eliminar todo el historial del usuario
 */
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM extractions WHERE user_id = $1 RETURNING COUNT(*) as count',
      [req.user.userId]
    );

    res.json({
      success: true,
      message: 'Historial eliminado exitosamente',
      deletedCount: result.rows[0]?.count || 0
    });

  } catch (error) {
    console.error('❌ Error en DELETE /extractions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar historial',
      error: error.message
    });
  }
});

/**
 * GET /api/extractions/stats/summary
 * Obtener estadísticas de uso
 */
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT
        COUNT(*) as total_extractions,
        COUNT(*) FILTER (WHERE success = true) as successful_extractions,
        COUNT(*) FILTER (WHERE success = false) as failed_extractions,
        AVG(processing_time_ms) FILTER (WHERE success = true) as avg_processing_time,
        MIN(created_at) as first_extraction,
        MAX(created_at) as last_extraction
       FROM extractions
       WHERE user_id = $1`,
      [req.user.userId]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        totalExtractions: parseInt(stats.total_extractions) || 0,
        successfulExtractions: parseInt(stats.successful_extractions) || 0,
        failedExtractions: parseInt(stats.failed_extractions) || 0,
        avgProcessingTime: Math.round(parseFloat(stats.avg_processing_time) || 0),
        firstExtraction: stats.first_extraction,
        lastExtraction: stats.last_extraction
      }
    });

  } catch (error) {
    console.error('❌ Error en /extractions/stats/summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

export default router;
