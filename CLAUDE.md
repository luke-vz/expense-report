# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

App para registrar los gastos del hogar de una pareja con **caja común** (gastos e ingresos compartidos). El objetivo de producto es **entender en qué se va la plata para armar un plan de ahorro**; toda funcionalidad nueva se evalúa contra eso. Se usa desde el celular, publicada en Vercel (https://expense-report-mu.vercel.app).

Stack: Next.js 15 (App Router, Turbopack) + React 19, Prisma 6 sobre PostgreSQL, Tailwind CSS v4, Recharts. UI en castellano rioplatense.

## Estado actual

**Etapa 1 (fundamentos) en producción desde 2026-10-05** (PR #6): categorías en tabla con página `/categories`, `amount` como `Decimal(12,2)`, `date` como `DATE`, helpers en `lib/format.ts`, migraciones automáticas en el build de producción.

**La base de producción TIENE DATOS REALES** (266 gastos al 2026-10-05) y no se puede resetear. La migración `categories_decimal_date` los conservó: las categorías que ya existían como texto (`Colegio`, `Entretenimiento`, `Tarjetas`) quedaron como categorías propias. Claude no tiene acceso a las credenciales de prod; cualquier operación directa sobre esa base la hace el usuario.

**Login con Google en producción desde 2026-10-05** (PR #9): next-auth v4 con allowlist de mails. Credenciales OAuth en un proyecto de Google Cloud del usuario (pantalla de consentimiento en modo prueba, con los dos mails como usuarios de prueba); variables cargadas en Vercel Production.

**Plan aprobado — "pre-gasto"** (sacar foto ahora, completar después), en etapas: (0) login con Google — hecho; (1) pendientes con foto (tabla separada de `Expense`, foto en Vercel Blob comprimida a ~200 KB, globito en la barra inferior, al completar la foto queda en `receiptUrl`); (2) lectura del ticket con IA para precompletar — el usuario eligió el modelo más barato (Claude Haiku 4.5); (3) notificación push diaria (service worker + tarea diaria de Vercel; en iPhone solo con la app instalada). Solo Google como proveedor de login (Apple requiere cuenta paga de developer).

**Próximos pasos:** el usuario está revisando el backlog de abajo para priorizarlo; no arranques ítems nuevos sin que elija. Lo recomendado: datos confiables: moneda ARS/USD, cuotas, dashboard mensual, clasificación fijo/variable/prescindible.

### Backlog (sin priorizar por el usuario todavía)

- **Deploy/datos:** la base de Preview no se migra sola (`DATABASE_URL` de Preview es una variable distinta de la de Production; no está confirmado si apuntan a la misma base); backups; sacar `log: ["query"]` de `lib/prisma.ts` en prod.
- **Prolijidad:** listado como tarjetas agrupadas por día en el celular (hoy la tabla se desplaza en horizontal); no hay tests (`parseAmount` es buen candidato para empezar).
- **Carga:** moneda ARS/USD con totales separados; compras en cuotas (cada cuota imputa a su mes); medio de pago; UI para `note` y foto de ticket (`receiptUrl` existe sin usar); gastos fijos/recurrentes con vencimiento; carga sin conexión (service worker + cola local); sugerencias al cargar (autocompletar detalle con categoría, gastos frecuentes como atajos); importar resúmenes de tarjeta/banco.
- **Análisis:** dashboard por mes (ranking con %, vs mes anterior y promedio 3 meses, top gastos); categorías marcadas fijo/variable/prescindible; subcategorías o etiquetas; búsqueda; equivalente en USD por fecha (inflación).
- **Ahorro:** ingresos y tasa de ahorro; presupuestos por categoría con alertas; metas de ahorro; exportar CSV/Excel.
- **Pareja:** quién cargó cada gasto (el login ya da el mail). No hace falta balance entre ellos: es caja común.

## Decisiones de arquitectura clave

- **`date` es `DATE`, no timestamp.** Un gasto es de un día calendario. Con timestamp, `"2026-09-26"` se guardaba como medianoche UTC y en Argentina (UTC-3) se mostraba el 25 y los gastos del día 1 caían en el mes anterior. La API sigue devolviendo `"YYYY-MM-DDT00:00:00.000Z"`, por eso en el cliente **se lee el día del string** (`lib/format.ts`) y nunca se pasa por `new Date()` para mostrar o agrupar.
- **`amount` es `Decimal(12,2)`** para no acumular errores de punto flotante en totales. Prisma devuelve `Decimal`, que en JSON sale como string: toda respuesta de gastos pasa por `serializeExpense` para que `amount` llegue como número.
- **Categorías en tabla, editables por el usuario.** Antes cada página tenía su propia lista hardcodeada y no coincidían (p. ej. `house` solo existía en el alta). Borrar una categoría con gastos se rechaza (409) en vez de cascada, para no perder datos.
- **Migraciones con datos se escriben a mano.** `prisma migrate dev` genera `DROP COLUMN` + `ADD COLUMN NOT NULL`, que pierde datos y falla con tablas no vacías. Generar con `--create-only`, reescribir el SQL para hacer backfill (ver la migración `categories_decimal_date`), y probarlo sobre una base aparte con datos en el formato viejo antes de aplicarlo.
- **Migraciones en el build, solo en producción y después de compilar** (`npm run build` → `prisma generate && next build && migrate:production`). Compilar primero hace que un build roto no toque la base; si `migrate deploy` falla, el deploy falla y producción sigue con la versión anterior. Las previews no migran para no tocar bases compartidas.
- **Las categorías por defecto se siembran en la migración** (no hay seed script), así cualquier base nueva queda usable.
- **next-auth v4 (estable), no v5** (en beta al 2026-10). En Vercel Production hay que fijar `NEXTAUTH_URL` a la URL pública: sin eso v4 usa `VERCEL_URL` (la URL propia de cada deploy) y Google rechaza el `redirect_uri`. El login no funciona en las previews (URL distinta, no registrada en Google); las previews ya están detrás de la protección de Vercel.
- **Montos tipeados en formato argentino.** El input de monto es `type="text" inputMode="decimal"` (no `type="number"`, que según el teclado rechaza la coma) y se interpreta con `parseAmount` (`lib/format.ts`): coma = decimal, puntos = miles; sin coma, un punto seguido de exactamente 3 dígitos es de miles (`1.500` → 1500), si no es decimal (`12.5`). La API recibe siempre un número.
- **Título opcional en la UI:** si queda vacío, el form manda el nombre de la categoría. La API sigue exigiendo `title` (el default lo pone el cliente).
- **Dashboard con una sola serie por gráfico, un solo color** (`#3987e5`, validado contra el fondo de las tarjetas `#2b2b2b`). Con 9+ categorías una torta repite colores; el ranking en barras se lee por la etiqueta del eje y responde directo "dónde se va la plata".
- **Filtrado y agregación en el cliente:** las páginas traen todos los gastos y filtran en el browser. Alcanza para el volumen de un hogar; no hace falta paginar por ahora.

## Convenciones

- Texto visible al usuario en castellano rioplatense (voseo: "Seleccioná", "¿Seguro que querés…?"). Identificadores de código en inglés.
- Las páginas son client components (`"use client"`) que hacen `fetch` a `/api/...` en `useEffect`. Los tipos compartidos del cliente (`Expense`, `Category`) están en `lib/expenses.ts`; no redeclarar interfaces locales.
- Handlers de API: validar a mano (sin zod; ver `lib/validation.ts`), leer el body con `req.json().catch(() => null)`, envolver escrituras de Prisma en `try/catch` y devolver `{ error }` con status. Mensajes de error de la API en inglés; los de la UI en castellano.
- Formularios de gastos: siempre a través de `components/ExpenseForm.tsx`; montos con `parseAmount`, y para precargar uno existente `toAmountInput`.
- Layouts pensados para el celular primero (se usa desde el teléfono): verificar a 390px de ancho. Botones de al menos ~44px de alto; el color de acción principal es `#3987e5`.
- No anidar `<main>`: el layout ya lo pone; las páginas usan `<div>`.
- Estilos: tema oscuro con las clases propias de `app/globals.css` (`bg-secundario`, `bg-input`, `bg-boton`, `border-card`, `header-bg`); reusarlas.
- Montos con `formatMoney` (formato `$1,500.00`; el usuario decidió mantenerlo así, no proponer `$1.500,00`), fechas con `formatDate` / `monthKey` / `monthLabel` / `todayISO` (`lib/format.ts`).
- Git: se trabaja en `develop` y se mergea a `main` por PR. Vercel despliega `main` a **Production** y los pushes a `develop` como **Preview**. Mensajes de commit cortos, en inglés, en minúscula.

## Comandos

```bash
npm run dev -- -p 3100   # dev server (en esta máquina 3000 y 3001 los usan otros proyectos)
npm run build            # prisma generate + next build (+ migrate deploy si VERCEL_ENV=production)
npm run lint             # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit         # chequeo de tipos (no hay script para esto)

npx prisma migrate dev --create-only --name <nombre>   # generar migración para revisarla/editarla
npx prisma migrate dev                                  # aplicar migraciones pendientes en local
npx prisma migrate deploy                               # lo corre el build de Vercel en producción
npx prisma studio
```

No hay tests ni test runner configurado.

**Probar con sesión sin pasar por Google:** `node --env-file=.env scripts/dev-session-cookie.mjs [email]` imprime una cookie firmada con el `NEXTAUTH_SECRET` local (`curl -b "$(...)"` o `context.addCookies` en Playwright). Sin cookie, toda la API da 401.

**Base local:** contenedor de podman `expense-report-pg` (Postgres 17, puerto 5434). `.env` (gitignoreado; plantilla en `.env.example`) con `DATABASE_URL="postgresql://expense:expense@localhost:5434/expense_report"` y las variables de auth. Si el contenedor no existe:

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
- **Tailwind:** v4 vía `@import "tailwindcss"` en `app/globals.css`; no hay `tailwind.config.js` ni modo claro. Las clases propias de `globals.css` no admiten variantes (`hover:bg-secundario` no funciona): para hover usar utilidades de Tailwind (p. ej. `hover:bg-neutral-800`).
- **`npm run build` con `npm run dev` corriendo** pisa `.next` y el dev server empieza a dar 500. Reiniciarlo con `rm -rf .next && npm run dev -- -p 3100`.
- **Probar en "celular":** Playwright con `executablePath: "/usr/bin/chromium-browser"` (la versión de navegador de Playwright no está instalada), viewport 390×844, `isMobile` y `hasTouch`. Recharts anima las barras al entrar: esperar ~2s antes de capturar el dashboard.
