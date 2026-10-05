# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

App para registrar los gastos del hogar de una pareja con **caja común** (gastos e ingresos compartidos). El objetivo de producto es **entender en qué se va la plata para armar un plan de ahorro**; toda funcionalidad nueva se evalúa contra eso. Se usa desde el celular, publicada en Vercel (https://expense-report-mu.vercel.app).

Stack: Next.js 15 (App Router, Turbopack) + React 19, Prisma 6 sobre PostgreSQL, Tailwind CSS v4, Recharts. UI en castellano rioplatense.

## Estado actual

**En curso — "etapa 1" (fundamentos), pusheada en `develop` (3ad7f74), SIN mergear a `main`:**
- `Category` pasó a ser una tabla (antes era un string con listas hardcodeadas distintas en cada página); página `/categories` para gestionarlas.
- `amount` pasó de `Float` a `Decimal(12,2)`; `date` pasó de timestamp a `DATE`.
- Helpers de fecha/monto en `lib/format.ts`, serialización en `lib/serialize.ts`, hook `lib/useCategories.ts`.
- Handlers de `[id]` con `await params`; la edición pide el gasto por id y muestra el error de guardado sin perder el formulario.
- Migración `prisma/migrations/20260926033501_categories_decimal_date/` — **editada a mano** para migrar datos (ver Decisiones).
- Verificado: `tsc` y `eslint` limpios; API probada end-to-end contra la base local; migración probada sobre datos con el formato viejo.

**Bloqueante para llevarlo a producción:** el build de Vercel (`next build`) **no corre migraciones**. El código nuevo y la migración tienen que llegar juntos a producción: si se mergea sin migrar, prod se rompe (busca `categoryId`); si se migra antes de mergear, también (el código viejo busca `category`). Propuesta pendiente de aprobar: correr `prisma migrate deploy` en el build **solo cuando `VERCEL_ENV=production`**.

**Riesgo conocido:** la app publicada no tiene login; la API responde a cualquiera. El usuario decidió **posponer el login** (no lo encares sin que lo pida).

**Próximos pasos:** el usuario está revisando el backlog de abajo para priorizarlo; no arranques ítems nuevos sin que elija. Lo recomendado: (1) commitear y llevar la etapa 1 a prod con la migración coordinada; (2) prolijidad rápida; (3) datos confiables: moneda ARS/USD, cuotas, dashboard mensual, clasificación fijo/variable/prescindible.

### Backlog (sin priorizar por el usuario todavía)

- **Deploy/datos:** migración automática solo en prod; base separada para previews (hoy pueden compartir la de prod — sin confirmar); backups; sacar `log: ["query"]` de `lib/prisma.ts` en prod.
- **Seguridad:** login (Auth.js + Google con allowlist de los dos mails — propuesta); validar input de la API (montos ≤ 0, fechas inválidas dan 500).
- **Prolijidad:** la página de edición usa fondo blanco (no respeta el tema oscuro); unificar formularios de alta/edición; borrar o reutilizar componentes sin usar; Tailwind config v3 que no se aplica; borrar un gasto no chequea `res.ok`; poco contraste en el menú; formato de montos (`$1,500.00` vs `$1.500,00`, a decidir); etiquetas y colores del dashboard (solo 4 colores); `app/OLDfavicon.ico` y SVGs de ejemplo; no hay tests.
- **Carga:** moneda ARS/USD con totales separados; compras en cuotas (cada cuota imputa a su mes); medio de pago; UI para `note` y foto de ticket (`receiptUrl` existe sin usar); gastos fijos/recurrentes con vencimiento; PWA/carga rápida; importar resúmenes de tarjeta/banco.
- **Análisis:** dashboard por mes (ranking con %, vs mes anterior y promedio 3 meses, top gastos); categorías marcadas fijo/variable/prescindible; subcategorías o etiquetas; búsqueda; equivalente en USD por fecha (inflación).
- **Ahorro:** ingresos y tasa de ahorro; presupuestos por categoría con alertas; metas de ahorro; exportar CSV/Excel.
- **Pareja (requiere login):** quién cargó cada gasto. No hace falta balance entre ellos: es caja común.

## Decisiones de arquitectura clave

- **`date` es `DATE`, no timestamp.** Un gasto es de un día calendario. Con timestamp, `"2026-09-26"` se guardaba como medianoche UTC y en Argentina (UTC-3) se mostraba el 25 y los gastos del día 1 caían en el mes anterior. La API sigue devolviendo `"YYYY-MM-DDT00:00:00.000Z"`, por eso en el cliente **se lee el día del string** (`lib/format.ts`) y nunca se pasa por `new Date()` para mostrar o agrupar.
- **`amount` es `Decimal(12,2)`** para no acumular errores de punto flotante en totales. Prisma devuelve `Decimal`, que en JSON sale como string: toda respuesta de gastos pasa por `serializeExpense` para que `amount` llegue como número.
- **Categorías en tabla, editables por el usuario.** Antes cada página tenía su propia lista hardcodeada y no coincidían (p. ej. `house` solo existía en el alta). Borrar una categoría con gastos se rechaza (409) en vez de cascada, para no perder datos.
- **Migraciones con datos se escriben a mano.** `prisma migrate dev` genera `DROP COLUMN` + `ADD COLUMN NOT NULL`, que pierde datos y falla con tablas no vacías. Generar con `--create-only`, reescribir el SQL para hacer backfill (ver la migración `categories_decimal_date`), y probarlo sobre una base aparte con datos en el formato viejo antes de aplicarlo.
- **Las categorías por defecto se siembran en la migración** (no hay seed script), así cualquier base nueva queda usable.
- **Filtrado y agregación en el cliente:** las páginas traen todos los gastos y filtran en el browser. Alcanza para el volumen de un hogar; no hace falta paginar por ahora.

## Convenciones

- Texto visible al usuario en castellano rioplatense (voseo: "Seleccioná", "¿Seguro que querés…?"). Identificadores de código en inglés.
- Las páginas son client components (`"use client"`) que hacen `fetch` a `/api/...` en `useEffect`. Los tipos compartidos del cliente (`Expense`, `Category`) están en `lib/expenses.ts`; no redeclarar interfaces locales.
- Handlers de API: validar campos requeridos a mano, envolver escrituras de Prisma en `try/catch` y devolver `{ error }` con status.
- Estilos: tema oscuro con las clases propias de `app/globals.css` (`bg-secundario`, `bg-input`, `bg-boton`, `border-card`, `header-bg`); reusarlas.
- Montos con `formatMoney`, fechas con `formatDate` / `monthKey` / `monthLabel` / `todayISO` (`lib/format.ts`).
- Git: se trabaja en `develop` y se mergea a `main` por PR. Vercel despliega `main` a **Production** y los pushes a `develop` como **Preview**. Mensajes de commit cortos, en inglés, en minúscula.

## Comandos

```bash
npm run dev -- -p 3100   # dev server (en esta máquina 3000 y 3001 los usan otros proyectos)
npm run build            # build de producción (Turbopack)
npm run lint             # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit         # chequeo de tipos (no hay script para esto)

npx prisma migrate dev --create-only --name <nombre>   # generar migración para revisarla/editarla
npx prisma migrate dev                                  # aplicar migraciones pendientes en local
npx prisma migrate deploy                               # aplicar migraciones en prod (hoy es manual)
npx prisma studio
```

No hay tests ni test runner configurado.

**Base local:** contenedor de podman `expense-report-pg` (Postgres 17, puerto 5434). `.env` (gitignoreado) con `DATABASE_URL="postgresql://expense:expense@localhost:5434/expense_report"`. Si el contenedor no existe:

```bash
podman run -d --name expense-report-pg -e POSTGRES_USER=expense -e POSTGRES_PASSWORD=expense \
  -e POSTGRES_DB=expense_report -p 5434:5432 docker.io/library/postgres:17-alpine
npx prisma migrate dev
```

## Gotchas

- **Cliente de Prisma viejo en dev:** `lib/prisma.ts` cachea el cliente en `global`. Después de `prisma generate`/`migrate dev` hay que **reiniciar `npm run dev`**; si no, aparecen `PrismaClientValidationError` o `Cannot read properties of undefined (reading 'findMany')`.
- **Vercel bloquea el deploy con versiones vulnerables de Next**: el build termina bien pero el deploy falla con `Vulnerable version of Next.js detected`. Se ve con `npx vercel inspect <deployment> --logs` (el CLI está logueado en esta máquina). Se resolvió subiendo Next a la última 15.5.x; ante un nuevo bloqueo, revisar `npm audit` y subir el patch. Quedan avisos de `postcss` (dentro de Next, solo se arregla con Next 16) y `deepmerge-ts`.
- **`params` es una Promise** en los route handlers de Next 15: tiparlo `{ params: Promise<{ id: string }> }` y hacer `await`.
- **Fechas:** ver Decisiones. Para el valor por defecto de un `<input type="date">` usar `todayISO()`, no `toISOString()` (de noche da la fecha de mañana).
- **Tailwind:** v4 vía `@import "tailwindcss"` en `globals.css`. `tailwind.config.js` es de v3 y no está referenciado (no hay `@config`), así que sus colores y `darkMode: 'class'` no se aplican; las clases `dark:` no hacen nada.
- **Código sin usar** (verificar antes de asumir que está en uso): helpers de fetch de `lib/expenses.ts` (solo se usan sus tipos), `components/ExpenseForm.tsx`, `ExpenseFilters.tsx` (estos dos con categorías hardcodeadas viejas), `ChartSummary.tsx`, `DarkModeToggle.tsx`.
