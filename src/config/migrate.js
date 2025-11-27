import { query } from './database.js';
import dotenv from 'dotenv';

dotenv.config();

// Script de migración para crear las tablas de la base de datos
const migrations = [
  // Tabla de usuarios
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture_url TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP,
    daily_extractions_count INTEGER DEFAULT 0,
    last_extraction_reset TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para users
  `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium)`,

  // Tabla de suscripciones
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL,
    purchase_token TEXT UNIQUE NOT NULL,
    order_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    auto_renewing BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para subscriptions
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_purchase_token ON subscriptions(purchase_token)`,
  `CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)`,

  // Tabla de extracciones (historial)
  `CREATE TABLE IF NOT EXISTS extractions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    module_type VARCHAR(100) NOT NULL,
    image_url TEXT,
    image_data TEXT,
    extracted_data JSONB NOT NULL,
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para extractions
  `CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_extractions_module_type ON extractions(module_type)`,

  // Tabla de sesiones (opcional, para refresh tokens)
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token TEXT UNIQUE NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para sessions
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,

  // Tabla de uso de API (para analytics)
  `CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices para api_usage
  `CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC)`,

  // Función para actualizar updated_at automáticamente
  `CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql`,

  // Triggers para updated_at
  `DROP TRIGGER IF EXISTS update_users_updated_at ON users`,
  `CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()`,

  `DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions`,
  `CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()`,
];

// Ejecutar migraciones
const runMigrations = async () => {
  console.log('🚀 Iniciando migraciones...\n');

  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`⏳ Ejecutando migración ${i + 1}/${migrations.length}...`);
      await query(migrations[i]);
      console.log(`✅ Migración ${i + 1} completada\n`);
    }

    console.log('🎉 Todas las migraciones completadas exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en las migraciones:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export default runMigrations;
