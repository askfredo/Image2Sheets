# Image2Sheet Backend API

Backend API para Image2Sheet - Aplicación de extracción de tablas de imágenes usando IA.

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **AI**: Google Gemini 2.5 Flash Lite
- **Auth**: Google OAuth 2.0 + JWT
- **Deployment**: Railway

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # Configuración PostgreSQL
│   │   └── migrate.js           # Script de migraciones
│   ├── middleware/
│   │   ├── auth.js              # Autenticación JWT
│   │   └── rateLimit.js         # Límites de uso
│   ├── routes/
│   │   ├── auth.js              # Endpoints de autenticación
│   │   ├── users.js             # Gestión de usuarios
│   │   ├── extractions.js       # Extracciones de tablas
│   │   ├── billing.js           # Suscripciones Premium
│   │   └── health.js            # Health check
│   ├── services/
│   │   └── gemini.js            # Servicio Gemini AI
│   └── server.js                # Servidor principal
├── .env.example                 # Ejemplo de variables de entorno
├── .gitignore
├── package.json
├── railway.json                 # Configuración Railway
└── README.md
```

## 🔧 Setup Local

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
# Server
NODE_ENV=development
PORT=3000

# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Google OAuth
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret

# JWT
JWT_SECRET=tu-secret-jwt-super-seguro
JWT_EXPIRES_IN=7d

# Gemini AI
GEMINI_API_KEY=tu-api-key-de-gemini
GEMINI_MODEL=gemini-2.5-flash-lite

# CORS
ALLOWED_ORIGINS=http://localhost:5173

# Límites
FREE_DAILY_EXTRACTIONS=5
FREE_HISTORY_DAYS=7
```

### 3. Crear base de datos

Asegúrate de tener PostgreSQL instalado y corriendo, o usa Railway.

### 4. Ejecutar migraciones

```bash
npm run migrate
```

Esto creará todas las tablas necesarias:
- `users` - Usuarios de la aplicación
- `subscriptions` - Suscripciones Premium
- `extractions` - Historial de extracciones
- `sessions` - Sesiones de usuario
- `api_usage` - Analytics de uso

### 5. Iniciar servidor de desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Estado del servidor

### Autenticación
- `POST /api/auth/google` - Login con Google OAuth
- `POST /api/auth/verify` - Verificar token JWT
- `POST /api/auth/logout` - Cerrar sesión

### Usuarios
- `GET /api/users/me` - Obtener información del usuario
- `GET /api/users/usage` - Obtener uso actual
- `PATCH /api/users/me` - Actualizar perfil
- `DELETE /api/users/me` - Eliminar cuenta

### Extracciones
- `POST /api/extractions/extract` - Extraer tabla de imagen
- `GET /api/extractions/history` - Obtener historial
- `GET /api/extractions/:id` - Obtener extracción específica
- `DELETE /api/extractions/:id` - Eliminar extracción
- `DELETE /api/extractions` - Eliminar todo el historial
- `GET /api/extractions/stats/summary` - Estadísticas de uso

### Billing (Suscripciones)
- `POST /api/billing/verify-purchase` - Verificar compra Premium
- `GET /api/billing/subscription` - Obtener suscripción actual
- `POST /api/billing/cancel` - Cancelar suscripción
- `GET /api/billing/history` - Historial de suscripciones

## 🔐 Autenticación

La API usa JWT (JSON Web Tokens) para autenticación.

### Flujo de autenticación:

1. Cliente obtiene token de Google OAuth
2. Cliente envía token a `POST /api/auth/google`
3. Backend verifica token con Google
4. Backend crea/actualiza usuario en DB
5. Backend genera JWT propio
6. Cliente usa JWT en header `Authorization: Bearer <token>`

### Ejemplo de request autenticada:

```javascript
fetch('https://api.image2sheet.com/api/users/me', {
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json'
  }
})
```

## 🚂 Deployment en Railway

### 1. Crear cuenta en Railway

Visita [railway.app](https://railway.app) y crea una cuenta.

### 2. Instalar Railway CLI (opcional)

```bash
npm i -g @railway/cli
railway login
```

### 3. Crear nuevo proyecto

```bash
railway init
```

### 4. Agregar PostgreSQL

En el dashboard de Railway:
1. Haz clic en "New"
2. Selecciona "Database"
3. Selecciona "PostgreSQL"
4. Copia la `DATABASE_URL`

### 5. Configurar variables de entorno

En Railway Dashboard > Variables, agrega:

```
NODE_ENV=production
DATABASE_URL=<copiado-de-railway-postgres>
GOOGLE_CLIENT_ID=tu-client-id
GOOGLE_CLIENT_SECRET=tu-client-secret
JWT_SECRET=tu-secret-super-seguro-y-largo
GEMINI_API_KEY=tu-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash-lite
ALLOWED_ORIGINS=https://tu-frontend.com,https://app.image2sheet.com
FREE_DAILY_EXTRACTIONS=5
FREE_HISTORY_DAYS=7
```

### 6. Deploy

```bash
# Commit tus cambios
git add .
git commit -m "Initial backend setup"

# Push a Railway (si usas CLI)
railway up

# O conecta tu repo de GitHub en Railway Dashboard
```

### 7. Ejecutar migraciones

En Railway Dashboard:
1. Abre la Terminal
2. Ejecuta: `npm run migrate`

### 8. Verificar deployment

```bash
curl https://tu-app.railway.app/api/health
```

## 📊 Base de Datos

### Schema Principal

#### users
```sql
id                      SERIAL PRIMARY KEY
google_id               VARCHAR(255) UNIQUE
email                   VARCHAR(255) UNIQUE
name                    VARCHAR(255)
picture_url             TEXT
is_premium              BOOLEAN DEFAULT FALSE
premium_expires_at      TIMESTAMP
daily_extractions_count INTEGER DEFAULT 0
last_extraction_reset   TIMESTAMP
created_at              TIMESTAMP DEFAULT NOW()
updated_at              TIMESTAMP DEFAULT NOW()
```

#### subscriptions
```sql
id             SERIAL PRIMARY KEY
user_id        INTEGER REFERENCES users(id)
product_id     VARCHAR(100)
purchase_token TEXT UNIQUE
order_id       VARCHAR(255)
status         VARCHAR(50) DEFAULT 'active'
start_date     TIMESTAMP
end_date       TIMESTAMP
auto_renewing  BOOLEAN DEFAULT TRUE
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

#### extractions
```sql
id                 SERIAL PRIMARY KEY
user_id            INTEGER REFERENCES users(id)
module_type        VARCHAR(100)
image_url          TEXT
image_data         TEXT
extracted_data     JSONB
processing_time_ms INTEGER
success            BOOLEAN DEFAULT TRUE
error_message      TEXT
created_at         TIMESTAMP
```

## 🔒 Seguridad

- ✅ Helmet.js para headers de seguridad
- ✅ CORS configurado
- ✅ Rate limiting
- ✅ JWT con expiración
- ✅ Validación de inputs
- ✅ Sanitización de queries (pg parameters)
- ✅ SSL en producción (Railway)

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test con autenticación
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential": "google-token-aqui"}'
```

## 📈 Monitoreo

Railway provee:
- Logs en tiempo real
- Métricas de CPU/RAM
- Uptime monitoring
- Crash detection

## 🐛 Troubleshooting

### Error: Database connection failed
- Verifica que `DATABASE_URL` esté correctamente configurada
- Asegúrate que Railway PostgreSQL esté corriendo

### Error: Token inválido
- Verifica que `JWT_SECRET` esté configurado
- Verifica que `GOOGLE_CLIENT_ID` sea correcto

### Error: Gemini API error
- Verifica que `GEMINI_API_KEY` sea válida
- Verifica límites de cuota en Google AI Studio

## 📝 Notas de Desarrollo

- **Límites Free Tier**: 5 extracciones diarias, historial de 7 días
- **Premium**: Extracciones ilimitadas, historial ilimitado
- **Modelo AI**: Gemini 2.5 Flash Lite (más rápido, eficiente y económico)
- **Max Image Size**: 8MB

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE

## 👨‍💻 Autor

Image2Sheet Team

---

**¿Necesitas ayuda?** Abre un issue en GitHub o contacta a support@image2sheet.com
