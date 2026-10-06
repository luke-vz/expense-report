# Expense Report

App para registrar los gastos del hogar y entender en qué se va la plata. Pensada para usarse desde el celular, instalada como app, por dos personas que comparten una caja común.

Producción: https://expense-report-mu.vercel.app (requiere una cuenta de Google autorizada).

## Qué hace

- **Carga rápida:**
  - monto grande con teclado numérico (acepta `1.500,50`) y moneda ARS o USD;
  - categorías como botones, ordenadas por uso;
  - atajos con los gastos más frecuentes y autocompletado del detalle;
  - fecha Hoy/Ayer;
  - "Guardar y otro" con "Deshacer".
- **Cuotas:** se carga el total y la cantidad, y se crea una cuota por mes ("Heladera 2/6"). La home muestra lo comprometido a futuro.
- **Gasto por voz:** un toque en 🎤, decís "gasté 1500 en el supermercado" y el formulario se completa solo (lo interpreta Claude Haiku); después, Guardar.
- **Fotos de tickets:** se adjuntan al cargar, o se guardan como **pendientes** para completar después (cámara o galería, también capturas de pantalla).
- **Aviso de duplicados:** si alguien ya cargó el mismo monto, en la misma categoría y el mismo día.
- **Listado** agrupado por día, con quién cargó cada gasto.
- **Dashboard por mes:** total y variación contra el mes anterior y el promedio de 3 meses, ranking de categorías, gastos más grandes y tendencia de 12 meses.
- **Categorías** editables (renombrar, unir, borrar).
- **Login con Google** restringido a una lista de mails.

## Stack

Next.js 15 (App Router) · React 19 · Prisma 6 + PostgreSQL · Tailwind CSS 4 · Recharts · next-auth 4 (Google) · Vercel Blob (fotos, privado) · Claude Haiku (gasto por voz) · desplegado en Vercel.

## Desarrollo local

Requisitos: Node 22 y Postgres. Con podman o docker:

```bash
podman run -d --name expense-report-pg -e POSTGRES_USER=expense -e POSTGRES_PASSWORD=expense \
  -e POSTGRES_DB=expense_report -p 5434:5432 docker.io/library/postgres:17-alpine

cp .env.example .env        # completar las variables (ver abajo)
npm ci
npx prisma migrate dev      # crea las tablas y las categorías por defecto
npm run dev -- -p 3100      # http://localhost:3100
```

Para probar sin pasar por Google se puede generar una cookie de sesión local:

```bash
node --env-file=.env scripts/dev-session-cookie.mjs tu@mail.com "Tu Nombre"
```

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL |
| `NEXTAUTH_SECRET` | Firma de las sesiones (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL pública de la app (`http://localhost:3100` en local) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth de Google Cloud |
| `ALLOWED_EMAILS` | Mails que pueden entrar, separados por coma |
| `ANTHROPIC_API_KEY` | Interpretar el gasto por voz (Claude Haiku). Con límite de gasto en la cuenta de Anthropic |
| `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` | Almacenamiento de fotos en Vercel Blob. Sin ninguna, las fotos se guardan en `./.uploads` |

En Google Cloud Console, el cliente OAuth necesita estas URIs de redirección:
- `https://expense-report-mu.vercel.app/api/auth/callback/google`
- `http://localhost:3100/api/auth/callback/google`

Mientras la pantalla de consentimiento esté en modo prueba, los mails permitidos tienen que figurar como usuarios de prueba.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | `prisma generate` + `next build`; en Vercel Production además aplica las migraciones |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npx prisma migrate dev --create-only --name <nombre>` | Generar una migración para revisarla antes de aplicarla |

## Deploy

- **Ramas y ambientes:** Vercel despliega `main` a producción y cada rama como preview.
- **Flujo:** cada cambio va en una rama, que sale de `develop`, con su PR a `main`.
- **Migraciones:** el build de producción aplica las migraciones pendientes después de compilar. Si algo falla, el deploy falla y producción sigue con la versión anterior.
- **Datos reales:** la base de producción tiene datos reales. Las migraciones que transforman datos se escriben a mano y se prueban antes sobre una copia.

## Más detalle

`CLAUDE.md` tiene:
- la arquitectura completa (API, páginas, auth, fotos, cuotas);
- las decisiones de diseño y su porqué;
- las convenciones del proyecto;
- los problemas conocidos;
- el backlog de pendientes.
