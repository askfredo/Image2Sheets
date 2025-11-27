# 🚂 Railway Quick Setup - Image2Sheet Backend

Guía rápida para desplegar en Railway desde GitHub.

---

## ✅ Código ya subido a GitHub

**Repositorio**: https://github.com/askfredo/Image2Sheets
**Branch**: main
**Commits**: 19 archivos (backend completo)

---

## 🚀 Pasos en Railway (5 minutos)

### 1️⃣ Login en Railway

1. Ve a https://railway.app
2. Click "Login" → Conecta con GitHub
3. Autoriza Railway en GitHub

---

### 2️⃣ Crear Nuevo Proyecto

1. Click **"New Project"**
2. Selecciona **"Deploy from GitHub repo"**
3. Busca y selecciona: **askfredo/Image2Sheets**
4. Railway detectará automáticamente que es Node.js

---

### 3️⃣ Agregar PostgreSQL

1. En el mismo proyecto, click **"+ New"**
2. Selecciona **"Database"**
3. Click **"Add PostgreSQL"**
4. Espera 30 segundos a que se provisione
5. Click en **PostgreSQL** → pestaña **"Connect"**
6. **Copia la "Postgres Connection URL"** completa

Ejemplo:
```
postgresql://postgres:PASS@containers-us-west-X.railway.app:PORT/railway
```

---

### 4️⃣ Configurar Variables de Entorno

1. Click en tu servicio **Image2Sheets** (el backend)
2. Ve a pestaña **"Variables"**
3. Click **"+ New Variable"** para cada una:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<PEGA_AQUI_LA_URL_DEL_PASO_3>
GOOGLE_CLIENT_ID=TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_GOOGLE_CLIENT_SECRET
JWT_SECRET=<GENERA_UNO_ALEATORIO_ABAJO>
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=TU_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash-lite
ALLOWED_ORIGINS=http://localhost:5173,https://tu-frontend-futuro.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
FREE_DAILY_EXTRACTIONS=5
FREE_HISTORY_DAYS=7
GOOGLE_PLAY_PACKAGE_NAME=com.image2sheet.app
```

**Para generar JWT_SECRET seguro**, copia este comando y pégalo en tu terminal local:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 5️⃣ Deploy Automático

Railway desplegará automáticamente. Verás:
```
Building...
Deploying...
Success! ✅
```

Esto toma 2-3 minutos.

---

### 6️⃣ Generar URL Pública

1. En tu servicio backend, ve a **"Settings"**
2. Scroll hasta **"Networking"** → **"Public Networking"**
3. Click **"Generate Domain"**
4. Te dará algo como: `https://image2sheets-production.up.railway.app`
5. **Guarda esta URL** para el frontend

---

### 7️⃣ Ejecutar Migraciones

1. En Railway, click en tu servicio backend
2. Click en el menú **"..."** (tres puntos arriba a la derecha)
3. Selecciona **"Open Terminal"** o **"Project Terminal"**
4. En la terminal, ejecuta:

```bash
npm run migrate
```

Deberías ver:
```
🚀 Iniciando migraciones...
✅ Migración 1 completada
✅ Migración 2 completada
...
🎉 Todas las migraciones completadas exitosamente!
```

---

### 8️⃣ Verificar Funcionamiento

Abre en tu navegador o usa curl:

```bash
curl https://tu-url.railway.app/api/health
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-11-26T...",
  "database": {
    "status": "connected"
  },
  "version": "1.0.0"
}
```

---

## 🎉 ¡Listo! Backend Desplegado

Tu backend ya está funcionando en:
```
https://tu-url.railway.app
```

### Endpoints disponibles:

- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/google`
- **Users**: `GET /api/users/me`
- **Extractions**: `POST /api/extractions/extract`
- **Billing**: `POST /api/billing/verify-purchase`

Ver lista completa: https://tu-url.railway.app/

---

## 🔧 Troubleshooting

### Error: Database connection failed
✅ **Solución**: Verifica que `DATABASE_URL` esté correctamente copiada de PostgreSQL

### Error: Migraciones fallan
✅ **Solución**: Asegúrate de estar en la terminal correcta y que DATABASE_URL exista

### Error: 503 Service Unavailable
✅ **Solución**: Espera 2-3 minutos, Railway aún está desplegando

### Ver Logs en Tiempo Real
1. Click en tu servicio
2. Pestaña **"Deployments"**
3. Click en el deployment activo
4. Verás logs en vivo

---

## 📊 Monitoreo

Railway provee automáticamente:
- ✅ Logs en tiempo real
- ✅ Métricas de CPU/RAM
- ✅ Uptime monitoring
- ✅ Auto-restart en crashes

Accede en la pestaña **"Metrics"**

---

## 💰 Costos

**Railway Hobby Plan**: $5/mes incluye:
- $5 de créditos mensuales
- Suficiente para backend + PostgreSQL
- Ejecución 24/7

**Costo estimado real**:
- Backend: ~$2-3/mes
- PostgreSQL: ~$1-2/mes
- **Total: ~$3-5/mes**

---

## 🔄 Actualizar Backend

Cuando hagas cambios al código:

```bash
cd /home/alf/Desktop/image2sheet/backend
git add .
git commit -m "Tu mensaje de cambio"
git push origin main
```

Railway detectará el push y **desplegará automáticamente**.

---

## 🔑 Credenciales que Necesitas

Antes de empezar, ten listas:

### Google OAuth
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`

**Obtener en**: https://console.cloud.google.com
→ APIs & Services → Credentials → OAuth 2.0 Client ID

### Gemini API
- [ ] `GEMINI_API_KEY`

**Obtener en**: https://aistudio.google.com/app/apikey
→ Click "Get API Key"

### JWT Secret
- [ ] `JWT_SECRET` (generar con el comando de arriba)

---

## ✅ Checklist Final

- [ ] Railway login exitoso
- [ ] Proyecto creado desde GitHub
- [ ] PostgreSQL provisionado
- [ ] Variables de entorno configuradas (14 variables)
- [ ] Domain generado
- [ ] Migraciones ejecutadas
- [ ] Health check responde OK
- [ ] URL guardada para frontend

---

## 📞 Ayuda

Si tienes problemas:
1. **Revisa los logs** en Railway (tab "Deployments")
2. **Verifica variables** están todas configuradas
3. **Check database connection** con `npm run migrate`

---

**Tiempo total**: 5-10 minutos
**Dificultad**: Fácil ⭐
**Resultado**: Backend funcionando en producción 🚀

¡Ahora puedes desarrollar el frontend sabiendo que el backend ya está corriendo!
