# 🚂 Guía de Deployment en Railway

Guía paso a paso para desplegar Image2Sheet Backend en Railway.

## 📋 Prerrequisitos

1. ✅ Cuenta en [Railway.app](https://railway.app)
2. ✅ Cuenta en [GitHub](https://github.com)
3. ✅ Google Cloud Console configurado (OAuth + Gemini API)

---

## 🔧 Paso 1: Preparar el Repositorio

### 1.1 Inicializar Git

```bash
cd /home/alf/Desktop/image2sheet/backend
git init
git add .
git commit -m "Initial commit: Image2Sheet backend"
```

### 1.2 Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre: `image2sheet-backend`
3. Descripción: "Backend API for Image2Sheet - AI-powered table extraction"
4. Visibilidad: Private (recomendado)
5. NO agregar README, .gitignore ni licencia (ya los tenemos)
6. Click "Create repository"

### 1.3 Conectar y subir

```bash
git remote add origin https://github.com/TU-USUARIO/image2sheet-backend.git
git branch -M main
git push -u origin main
```

---

## 🗄️ Paso 2: Crear Base de Datos PostgreSQL

### 2.1 Login en Railway

1. Ve a https://railway.app
2. Haz clic en "Login" o "Start a New Project"
3. Conecta con GitHub

### 2.2 Crear nuevo proyecto

1. Click "New Project"
2. Selecciona "Provision PostgreSQL"
3. Espera a que se cree la instancia (1-2 minutos)

### 2.3 Obtener DATABASE_URL

1. Click en la instancia de PostgreSQL
2. Ve a la pestaña "Connect"
3. Copia el "Postgres Connection URL"
4. Guárdalo temporalmente (lo usaremos después)

Ejemplo:
```
postgresql://postgres:PASSWORD@containers-us-west-X.railway.app:PORT/railway
```

---

## 🚀 Paso 3: Desplegar el Backend

### 3.1 Agregar servicio desde GitHub

1. En el mismo proyecto de Railway, click "+ New"
2. Selecciona "GitHub Repo"
3. Busca y selecciona `image2sheet-backend`
4. Railway detectará automáticamente que es Node.js

### 3.2 Configurar variables de entorno

En el servicio del backend:
1. Click en la pestaña "Variables"
2. Click "+ Add Variable" y agrega cada una:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<PEGA_AQUI_LA_URL_DE_POSTGRESQL_DEL_PASO_2.3>
GOOGLE_CLIENT_ID=TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=TU_GOOGLE_CLIENT_SECRET
JWT_SECRET=genera-un-string-aleatorio-muy-largo-y-seguro-aqui
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=TU_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash-lite
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio-frontend.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
FREE_DAILY_EXTRACTIONS=5
FREE_HISTORY_DAYS=7
GOOGLE_PLAY_PACKAGE_NAME=com.image2sheet.app
```

**IMPORTANTE**: Para `JWT_SECRET`, genera un string aleatorio seguro:
```bash
# En tu terminal local:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3.3 Generar Domain

1. En el servicio del backend, ve a "Settings"
2. Scroll hasta "Domains"
3. Click "Generate Domain"
4. Obtendrás algo como: `https://image2sheet-backend-production.up.railway.app`
5. **Guarda esta URL**, la necesitarás en el frontend

---

## 🗃️ Paso 4: Ejecutar Migraciones

### 4.1 Abrir terminal en Railway

1. En el servicio del backend, ve a la pestaña superior
2. Click en el menú "..." (tres puntos)
3. Selecciona "Open Terminal"

### 4.2 Ejecutar migración

En la terminal de Railway, ejecuta:

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

## ✅ Paso 5: Verificar Deployment

### 5.1 Health Check

Abre en tu navegador o usa curl:

```bash
curl https://tu-app.railway.app/api/health
```

Deberías ver:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-11-26T...",
  "uptime": 123.456,
  "environment": "production",
  "database": {
    "status": "connected",
    "timestamp": "2024-11-26T..."
  },
  "version": "1.0.0"
}
```

### 5.2 Test de endpoint raíz

```bash
curl https://tu-app.railway.app/
```

Deberías ver:
```json
{
  "message": "🚀 Image2Sheet API - Backend funcionando correctamente",
  "version": "1.0.0",
  "endpoints": {
    "health": "/api/health",
    "auth": "/api/auth",
    "users": "/api/users",
    "extractions": "/api/extractions",
    "billing": "/api/billing"
  }
}
```

---

## 🔑 Paso 6: Configurar Google OAuth

### 6.1 Agregar URI de Railway a Google Cloud Console

1. Ve a https://console.cloud.google.com
2. Selecciona tu proyecto
3. APIs & Services > Credentials
4. Click en tu OAuth 2.0 Client ID
5. En "Authorized redirect URIs", agrega:
   ```
   https://tu-app.railway.app/api/auth/callback
   ```
6. En "Authorized JavaScript origins", agrega:
   ```
   https://tu-app.railway.app
   ```
7. Click "Save"

---

## 🎨 Paso 7: Configurar Frontend

En tu aplicación frontend (React/Capacitor), actualiza la URL del API:

```javascript
// src/config/api.js
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://tu-app.railway.app/api'
  : 'http://localhost:3000/api';

export default API_BASE_URL;
```

---

## 📊 Paso 8: Monitoreo

### 8.1 Ver logs en tiempo real

1. En Railway, click en tu servicio backend
2. Ve a la pestaña "Deployments"
3. Click en el deployment activo
4. Verás los logs en tiempo real

### 8.2 Métricas

Railway provee automáticamente:
- CPU usage
- Memory usage
- Network I/O
- Request count

Accede a ellas en la pestaña "Metrics"

---

## 🔄 Paso 9: Actualizar el Backend

### 9.1 Cambios en el código

```bash
# Haz tus cambios en el código
git add .
git commit -m "Descripción de tus cambios"
git push origin main
```

### 9.2 Deploy automático

Railway detectará el push y desplegará automáticamente.
Puedes ver el progreso en "Deployments"

---

## 🆘 Troubleshooting

### Error: Database connection failed

**Solución**:
1. Verifica que la variable `DATABASE_URL` esté correctamente configurada
2. Asegúrate que PostgreSQL esté corriendo en Railway
3. Ve a PostgreSQL > "Connect" y copia nuevamente la URL

### Error: Module not found

**Solución**:
```bash
# Asegúrate que package.json tenga todas las dependencias
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Error: Port already in use

**Solución**:
Railway asigna automáticamente el puerto. Asegúrate que en server.js uses:
```javascript
const PORT = process.env.PORT || 3000;
```

### Migraciones no se ejecutaron

**Solución**:
1. Abre terminal en Railway
2. Ejecuta manualmente: `npm run migrate`
3. Si falla, verifica logs con: `npm run migrate 2>&1`

---

## 📈 Optimizaciones Post-Deploy

### 1. Configurar Auto-Scaling (opcional)

Railway escala automáticamente, pero puedes configurar límites:
1. Settings > Resources
2. Ajusta CPU y RAM según necesites

### 2. Configurar Alertas

1. Settings > Notifications
2. Configura alertas de email para:
   - Deployment failures
   - High resource usage
   - Downtime

### 3. Configurar Dominio Personalizado (opcional)

1. Compra un dominio (ej: image2sheet.com)
2. En Railway: Settings > Domains
3. Click "Add Custom Domain"
4. Sigue las instrucciones para configurar DNS

---

## 💰 Costos Estimados

Railway - Modelo de Pricing:
- **Hobby Plan**: $5/mes incluye:
  - $5 de créditos
  - PostgreSQL incluido
  - Ejecución 24/7

- **Costo estimado mensual**:
  - Backend API: ~$2-4/mes
  - PostgreSQL: ~$1-2/mes
  - **Total**: ~$3-6/mes

**Nota**: Railway solo cobra por uso real, no hay cargos fijos.

---

## ✅ Checklist Final

Antes de poner en producción, verifica:

- [ ] Migraciones ejecutadas correctamente
- [ ] Health check responde OK
- [ ] Variables de entorno configuradas
- [ ] Google OAuth configurado con URL de Railway
- [ ] Gemini API key válida
- [ ] CORS configurado con dominio del frontend
- [ ] Logs no muestran errores
- [ ] Test de autenticación funciona
- [ ] Test de extracción funciona
- [ ] Límites de rate limiting configurados
- [ ] Backup de variables de entorno guardado

---

## 🎉 ¡Listo!

Tu backend está desplegado y listo para usar.

**URLs importantes**:
- Backend API: `https://tu-app.railway.app`
- Health Check: `https://tu-app.railway.app/api/health`
- Railway Dashboard: `https://railway.app`

**Próximos pasos**:
1. Desplegar el frontend
2. Configurar AdMob en el frontend
3. Configurar Google Play Billing
4. Testear flujo completo end-to-end

¿Necesitas ayuda? Revisa los logs en Railway o contacta a support@image2sheet.com
