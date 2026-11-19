# VuelosApp — Sistema de Reservación de Vuelos Seguro

Proyecto académico completo: React + Node.js + Express + PostgreSQL + Prisma  
Enfoque: OWASP Top 10 + STRIDE + SecDevOps

---

## Estructura del proyecto

```
flight-system/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       ← Modelos de BD
│   │   └── seed.js             ← Datos de prueba
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js         ← JWT + RBAC + CSRF
│   │   ├── routes/
│   │   │   ├── auth.js         ← /api/auth/*
│   │   │   ├── vuelos.js       ← /api/vuelos/*
│   │   │   ├── reservas.js     ← /api/reservas/*
│   │   │   └── admin.js        ← /api/admin/*
│   │   └── server.js           ← Entry point, Helmet, Rate Limit, CORS
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.jsx  ← Estado global de usuario
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Vuelos.jsx
    │   │   ├── Reservas.jsx
    │   │   └── Admin.jsx
    │   ├── services/
    │   │   └── api.js           ← Axios + CSRF interceptor
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 14+ instalado y corriendo
- npm

---

## 1. Instalar PostgreSQL (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Crear la base de datos

```bash
sudo -u postgres psql
```

Dentro de psql:
```sql
CREATE USER miusuario WITH PASSWORD 'mipassword';
CREATE DATABASE vuelos_db OWNER miusuario;
GRANT ALL PRIVILEGES ON DATABASE vuelos_db TO miusuario;
\q
```

---

## 2. Instalar PostgreSQL (macOS con Homebrew)

```bash
brew install postgresql@15
brew services start postgresql@15
createdb vuelos_db
```

---

## 3. Instalar PostgreSQL (Windows)

Descargar el instalador desde: https://www.postgresql.org/download/windows/  
Usar pgAdmin para crear la base de datos `vuelos_db`.

---

## 4. Configurar el Backend

```bash
cd backend

# Copiar archivo de variables de entorno
cp .env.example .env
```

Editar `.env` con tus datos:
```
DATABASE_URL="postgresql://miusuario:mipassword@localhost:5432/vuelos_db"
JWT_SECRET="un_secreto_muy_largo_y_aleatorio_de_al_menos_32_caracteres"
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Aplicar migraciones (crea las tablas)
npx prisma migrate dev --name init

# Poblar con datos de prueba
npm run seed
```

---

## 5. Configurar el Frontend

```bash
cd frontend

# Instalar dependencias
npm install
```

> El proxy en `vite.config.js` redirige `/api` → `http://localhost:4000`  
> No necesitas configurar nada más.

---

## 6. Ejecutar el proyecto

### Terminal 1 — Backend:
```bash
cd backend
npm run dev
# Corre en http://localhost:4000
```

### Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
# Corre en http://localhost:5173
```

Abrir en el navegador: **http://localhost:5173**

---

## Usuarios de prueba (creados con seed)

| Rol   | Email                | Contraseña  |
|-------|----------------------|-------------|
| ADMIN | admin@vuelos.com     | Admin123!   |
| STAFF | staff@vuelos.com     | Staff123!   |
| CLIENT| cliente@vuelos.com   | Client123!  |

---

## Funcionalidades por rol

### CLIENT
- Registro e inicio de sesión
- Buscar vuelos disponibles
- Crear reservas (expiran en 10 minutos)
- Ver mis reservas y tiempo restante
- Pagar reserva (pago simulado, genera folio UUID)
- Cancelar reservas propias

### STAFF
- Todo lo anterior
- Crear vuelos
- Editar vuelos
- Actualizar disponibilidad

### ADMIN
- Todo lo anterior
- Gestionar usuarios (cambiar rol, eliminar)
- Ver TODAS las reservas
- Eliminar vuelos

---

## Seguridad implementada (STRIDE + OWASP)

### STRIDE
| Amenaza | Mitigación |
|---------|-----------|
| Spoofing | JWT firmado con HS256 + bcrypt salt=10 |
| Tampering | express-validator en todos los endpoints |
| Information Disclosure | Cookies HttpOnly, nunca devolver passwords |
| DoS | express-rate-limit global (100/15min) + auth (10/15min) |
| Elevation of Privilege | RBAC con middleware authorizeRoles |

### OWASP Top 10
| Vulnerabilidad | Control |
|---------------|---------|
| A01 Broken Access Control | IDOR: verificar usuarioId === req.user.id antes de operar reservas |
| A02 Authentication Failures | bcrypt + JWT corto (8h) + rate limit en login |
| A03 Injection | Prisma ORM previene SQL injection por defecto |
| A05 Security Misconfiguration | Helmet headers + CORS restringido + NODE_ENV |
| CSRF | Cookie csrf-token + header x-csrf-token double-submit |

---

## Endpoints principales

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
PUT    /api/auth/perfil

GET    /api/vuelos               ← público
GET    /api/vuelos/todos         ← ADMIN/STAFF
POST   /api/vuelos               ← ADMIN/STAFF
PUT    /api/vuelos/:id           ← ADMIN/STAFF
DELETE /api/vuelos/:id           ← ADMIN only

GET    /api/reservas             ← propias (CLIENT) o todas (ADMIN)
POST   /api/reservas             ← CLIENT
POST   /api/reservas/:id/pagar  ← CLIENT (propio)
DELETE /api/reservas/:id         ← CLIENT (propio)
GET    /api/reservas/admin/todas ← ADMIN

GET    /api/admin/usuarios       ← ADMIN
PUT    /api/admin/usuarios/:id/role ← ADMIN
DELETE /api/admin/usuarios/:id   ← ADMIN
```

---

## Comandos útiles de Prisma

```bash
# Ver base de datos en GUI
npx prisma studio

# Resetear BD (borra todo y vuelve a crear)
npx prisma migrate reset

# Re-sembrar datos
npm run seed
```

---

## Solución de problemas comunes

**Error: `Cannot connect to database`**  
→ Verificar que PostgreSQL esté corriendo y que `DATABASE_URL` tenga los datos correctos

**Error: `Prisma Client not generated`**  
→ Ejecutar `npx prisma generate`

**Error: `CORS`**  
→ Verificar que `FRONTEND_URL=http://localhost:5173` esté en `.env`

**Error: `401 Token inválido`**  
→ Limpiar cookies del navegador y volver a iniciar sesión
