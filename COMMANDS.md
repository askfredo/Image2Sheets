# 🔧 Image2Sheet Backend - Comandos Útiles

Referencia rápida de comandos útiles para desarrollo y deployment.

---

## 📦 NPM Commands

```bash
# Instalar dependencias
npm install

# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start

# Ejecutar migraciones
npm run migrate

# Seed database (futuro)
npm run seed
```

---

## 🗄️ PostgreSQL Commands

### Local PostgreSQL

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear base de datos
CREATE DATABASE image2sheet;

# Conectar a DB específica
\c image2sheet

# Listar tablas
\dt

# Ver estructura de tabla
\d users

# Ver todas las conexiones
SELECT * FROM pg_stat_activity;

# Salir
\q
```

### Railway PostgreSQL (desde CLI)

```bash
# Conectar a Railway DB
psql $DATABASE_URL

# Ver tablas
\dt

# Contar usuarios
SELECT COUNT(*) FROM users;

# Ver últimas extracciones
SELECT id, module_type, success, created_at
FROM extractions
ORDER BY created_at DESC
LIMIT 10;

# Ver usuarios premium
SELECT id, email, name, is_premium, premium_expires_at
FROM users
WHERE is_premium = true;
```

---

## 🐛 Debugging Commands

### Ver logs del servidor

```bash
# Desarrollo (con nodemon)
npm run dev

# Ver logs en Railway
railway logs
```

### Test endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Root endpoint
curl http://localhost:3000/

# Test con JSON
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential": "test-token"}'
```

### Verificar variables de entorno

```bash
# Ver todas las variables
cat .env

# Verificar una específica
grep GEMINI_API_KEY .env

# Test que carguen correctamente
node -e "require('dotenv').config(); console.log(process.env.GEMINI_API_KEY)"
```

---

## 🔑 Generar Secrets

```bash
# JWT Secret (64 bytes hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# UUID aleatorio
node -e "console.log(require('crypto').randomUUID())"

# Random string
openssl rand -hex 32
```

---

## 🚂 Railway Commands

### Setup Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Ver proyectos
railway list

# Seleccionar proyecto
railway link

# Ver variables
railway variables

# Agregar variable
railway variables set KEY=value

# Ver logs
railway logs

# Abrir dashboard
railway open

# Deploy manual
railway up
```

---

## 🔄 Git Commands

### Setup inicial

```bash
# Inicializar repo
git init

# Agregar remote
git remote add origin https://github.com/USER/image2sheet-backend.git

# Ver status
git status

# Agregar todos los archivos
git add .

# Commit
git commit -m "Initial commit: Image2Sheet backend"

# Push
git push -u origin main
```

### Updates

```bash
# Ver cambios
git diff

# Agregar cambios
git add .

# Commit con mensaje
git commit -m "Add new feature"

# Push a GitHub
git push

# Ver historial
git log --oneline

# Ver branches
git branch -a
```

---

## 🧪 Testing Commands

### Manual API Testing

```bash
# Test health
curl http://localhost:3000/api/health | jq

# Test con autenticación
TOKEN="your-jwt-token-here"
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/users/me | jq

# Test POST
curl -X POST http://localhost:3000/api/extractions/extract \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-payload.json | jq
```

### Performance Testing

```bash
# Apache Bench (100 requests, 10 concurrent)
ab -n 100 -c 10 http://localhost:3000/api/health

# curl timing
curl -w "\nTime: %{time_total}s\n" http://localhost:3000/api/health
```

---

## 📊 Database Queries Útiles

```sql
-- Ver usuarios registrados hoy
SELECT COUNT(*) FROM users
WHERE created_at::date = CURRENT_DATE;

-- Extracciones por día (última semana)
SELECT
  DATE(created_at) as date,
  COUNT(*) as extractions,
  COUNT(*) FILTER (WHERE success = true) as successful
FROM extractions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Top usuarios por extracciones
SELECT
  u.email,
  COUNT(e.id) as total_extractions
FROM users u
LEFT JOIN extractions e ON e.user_id = u.id
GROUP BY u.id, u.email
ORDER BY total_extractions DESC
LIMIT 10;

-- Suscripciones activas
SELECT
  u.email,
  s.product_id,
  s.start_date,
  s.end_date,
  s.auto_renewing
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.status = 'active'
ORDER BY s.created_at DESC;

-- Resetear contador de extracciones (testing)
UPDATE users
SET daily_extractions_count = 0,
    last_extraction_reset = NOW()
WHERE email = 'test@example.com';

-- Ver uso de API por endpoint
SELECT
  endpoint,
  COUNT(*) as requests,
  AVG(response_time_ms) as avg_response_time
FROM api_usage
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY requests DESC;
```

---

## 🔒 Security Commands

```bash
# Verificar dependencias con vulnerabilidades
npm audit

# Arreglar automáticamente
npm audit fix

# Ver paquetes desactualizados
npm outdated

# Actualizar paquetes
npm update
```

---

## 🧹 Cleanup Commands

```bash
# Limpiar node_modules
rm -rf node_modules package-lock.json
npm install

# Limpiar logs
rm -rf logs/*.log

# Limpiar caché npm
npm cache clean --force
```

---

## 🎯 Comandos de Producción

### Pre-deploy Checklist

```bash
# 1. Test todas las variables de entorno
node -e "require('dotenv').config();
  console.log('DB:', !!process.env.DATABASE_URL);
  console.log('Google:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('Gemini:', !!process.env.GEMINI_API_KEY);
  console.log('JWT:', !!process.env.JWT_SECRET);"

# 2. Test migraciones
npm run migrate

# 3. Test servidor local
npm start &
sleep 3
curl http://localhost:3000/api/health
killall node

# 4. Verificar .gitignore
cat .gitignore | grep -E "node_modules|.env"

# 5. Commit final
git add .
git commit -m "Ready for production"
git push
```

### Post-deploy Verification

```bash
# 1. Health check
curl https://tu-app.railway.app/api/health

# 2. Ver logs
railway logs --follow

# 3. Test endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
     https://tu-app.railway.app/api/users/me
```

---

## 📈 Monitoring Commands

```bash
# Ver uso de recursos
top
htop

# Ver conexiones PostgreSQL
lsof -i :5432

# Ver puerto ocupado
lsof -i :3000

# Matar proceso en puerto
kill -9 $(lsof -t -i:3000)

# Ver logs del sistema
journalctl -u postgresql -f
```

---

## 🔄 Backup y Restore

### Backup Database

```bash
# Local PostgreSQL
pg_dump -U postgres image2sheet > backup_$(date +%Y%m%d).sql

# Railway (desde railway CLI)
railway run pg_dump > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
# Local
psql -U postgres image2sheet < backup_20241126.sql

# Railway
railway run psql < backup_20241126.sql
```

---

## 🚀 Quick Start Full Flow

```bash
# Setup completo desde cero
cd /home/alf/Desktop/image2sheet/backend

# 1. Instalar
npm install

# 2. Configurar
cp .env.example .env
nano .env  # Editar variables

# 3. Database
npm run migrate

# 4. Iniciar
npm run dev

# 5. Test
curl http://localhost:3000/api/health

# 6. Deploy
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main

# Luego configurar Railway desde el dashboard
```

---

## 💡 Tips y Trucos

### Desarrollo rápido

```bash
# Watch logs y reiniciar automáticamente
npm run dev | tee logs/dev.log

# Ejecutar comando en background
npm run dev > /dev/null 2>&1 &

# Ver último error en logs
tail -n 50 logs/error.log

# Buscar en logs
grep "ERROR" logs/*.log
```

### Database helpers

```bash
# Contar todas las tablas
for table in users subscriptions extractions sessions api_usage; do
  echo -n "$table: "
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM $table" -t
done

# Ver tamaño de tablas
psql $DATABASE_URL -c "
  SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

**Tip**: Agrega este archivo a favoritos para acceso rápido a comandos comunes!
