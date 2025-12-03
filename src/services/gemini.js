import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Inicializar Gemini AI con la API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Modelo: Gemini 2.5 Flash Lite (más rápido, eficiente y económico)
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

/**
 * Extrae una tabla de una imagen usando Gemini AI
 * @param {Object} imagePart - Parte de la imagen en formato Gemini
 * @returns {Promise<Object>} - Objeto con headers y rows de la tabla
 */
export const extractTable = async (imagePart) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Analiza esta imagen y extrae la tabla que contiene.

IMPORTANTE: Debes devolver SOLO un objeto JSON válido, sin texto adicional antes o después.

El JSON debe tener esta estructura:
{
  "headers": ["Columna1", "Columna2", "Columna3"],
  "rows": [
    ["valor1", "valor2", "valor3"],
    ["valor4", "valor5", "valor6"]
  ]
}

Reglas:
1. Si la tabla tiene encabezados visibles, úsalos. Si no, genera nombres descriptivos (Columna 1, Columna 2, etc.)
2. Preserva todos los datos exactamente como aparecen
3. Si una celda está vacía, usa una cadena vacía ""
4. Mantén el formato de números, fechas y texto tal cual
5. Si hay varias tablas, extrae la más grande o prominente
6. Devuelve SOLO el JSON, sin marcadores de código ni explicaciones

Respuesta:`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    // Limpiar la respuesta (remover markdown code blocks si los hay)
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Parsear el JSON
    const tableData = JSON.parse(text);

    // Validar estructura
    if (!tableData.headers || !Array.isArray(tableData.headers)) {
      throw new Error('Formato de tabla inválido: falta el campo "headers"');
    }

    if (!tableData.rows || !Array.isArray(tableData.rows)) {
      throw new Error('Formato de tabla inválido: falta el campo "rows"');
    }

    return tableData;
  } catch (error) {
    console.error('❌ Error en extractTable:', error);
    throw new Error(`Error al extraer tabla: ${error.message}`);
  }
};

/**
 * Extrae múltiples tablas de una imagen
 * @param {Object} imagePart - Parte de la imagen en formato Gemini
 * @returns {Promise<Array>} - Array de objetos de tablas
 */
export const extractMultipleTables = async (imagePart) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const prompt = `Analiza esta imagen y extrae TODAS las tablas que encuentres.

Devuelve un array JSON con todas las tablas encontradas:
[
  {
    "name": "Nombre descriptivo de la tabla",
    "headers": ["Col1", "Col2"],
    "rows": [["val1", "val2"]]
  }
]

Si solo hay una tabla, devuelve un array con un elemento.
Devuelve SOLO el JSON, sin explicaciones.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();

    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const tables = JSON.parse(text);

    return Array.isArray(tables) ? tables : [tables];
  } catch (error) {
    console.error('❌ Error en extractMultipleTables:', error);
    throw new Error(`Error al extraer múltiples tablas: ${error.message}`);
  }
};

/**
 * Analiza la calidad de una tabla extraída
 * @param {Object} tableData - Datos de la tabla
 * @returns {Object} - Métricas de calidad
 */
/**
 * Convierte datos de tabla a formato Markdown
 * @param {Object} tableData - Datos de la tabla con headers y rows
 * @returns {string} - Tabla en formato Markdown
 */
export const tableToMarkdown = (tableData) => {
  const { headers, rows } = tableData;

  // Crear línea de encabezados
  const headerLine = '| ' + headers.join(' | ') + ' |';

  // Crear línea separadora
  const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';

  // Crear líneas de datos
  const dataLines = rows.map(row => '| ' + row.join(' | ') + ' |');

  // Combinar todo
  return [headerLine, separatorLine, ...dataLines].join('\n');
};

/**
 * Convierte datos de tabla a formato CSV
 * @param {Object} tableData - Datos de la tabla con headers y rows
 * @returns {string} - Tabla en formato CSV
 */
export const tableToCSV = (tableData) => {
  const { headers, rows } = tableData;

  // Función para escapar valores CSV
  const escapeCSV = (value) => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  // Crear línea de encabezados
  const headerLine = headers.map(escapeCSV).join(',');

  // Crear líneas de datos
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));

  // Combinar todo
  return [headerLine, ...dataLines].join('\n');
};

export const analyzeTableQuality = (tableData) => {
  const { headers, rows } = tableData;

  // Calcular métricas
  const totalCells = rows.length * headers.length;
  const emptyCells = rows.reduce((count, row) => {
    return count + row.filter(cell => cell === '' || cell === null).length;
  }, 0);

  const completeness = ((totalCells - emptyCells) / totalCells) * 100;

  // Verificar consistencia de columnas
  const consistentColumns = rows.every(row => row.length === headers.length);

  return {
    totalRows: rows.length,
    totalColumns: headers.length,
    totalCells,
    emptyCells,
    completeness: Math.round(completeness * 100) / 100,
    consistentColumns,
    quality: completeness > 90 ? 'high' : completeness > 70 ? 'medium' : 'low'
  };
};

/**
 * Convierte imagen base64 a formato Gemini Part
 * @param {string} base64Image - Imagen en base64
 * @param {string} mimeType - Tipo MIME de la imagen
 * @returns {Object} - Parte de imagen para Gemini
 */
export const base64ToGeminiPart = (base64Image, mimeType = 'image/png') => {
  // Remover el prefijo "data:image/xxx;base64," si existe
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  return {
    inlineData: {
      data: base64Data,
      mimeType: mimeType
    }
  };
};

/**
 * Valida si una imagen es válida para procesamiento
 * @param {string} base64Image - Imagen en base64
 * @returns {Object} - { valid: boolean, error?: string }
 */
export const validateImage = (base64Image) => {
  try {
    // Verificar que sea base64 válido
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // Validar longitud (máximo ~8MB en base64)
    const maxSize = 8 * 1024 * 1024 * (4/3); // 8MB convertido a base64
    if (base64Data.length > maxSize) {
      return { valid: false, error: 'Imagen demasiado grande (máximo 8MB)' };
    }

    // Validar que sea base64 válido
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      return { valid: false, error: 'Formato de imagen inválido' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

export default {
  extractTable,
  extractMultipleTables,
  analyzeTableQuality,
  tableToMarkdown,
  tableToCSV,
  base64ToGeminiPart,
  validateImage
};
