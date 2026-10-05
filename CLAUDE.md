# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

App para registrar los gastos del hogar de una pareja con **caja común** (gastos e ingresos compartidos). El objetivo de producto es **entender en qué se va la plata para armar un plan de ahorro**; toda funcionalidad nueva se evalúa contra eso. Se usa desde el celular, publicada en Vercel (https://expense-report-mu.vercel.app).

Stack: Next.js 15 (App Router, Turbopack) + React 19, Prisma 6 sobre PostgreSQL, Tailwind CSS v4, Recharts. UI en castellano rioplatense.

## Estado actual

**Etapa 1 (fundamentos) en producción desde 2026-10-05** (PR #6): categorías en tabla con página `/categories`, `amount` como `Decimal(12,2)`, `date` como `DATE`, helpers en `lib/format.ts`, migraciones automáticas en el build de producción.

**La base de producción TIENE DATOS REALES** (266 gastos al 2026-10-05) y no se puede resetear. La migración `categories_decimal_date` los conservó: las categorías que ya existían como texto (`Colegio`, `Entretenimiento`, `Tarjetas`) quedaron como categorías propias. Claude no tiene acceso a las credenciales de prod; cualquier operación directa sobre esa base la hace el usuario.

**Login con Google en producción desde 2026-10-05** (PR #9): next-auth v4 con allowlist de mails. Credenciales OAuth en un proyecto de Google Cloud del usuario (pantalla de consentimiento en modo prueba, con los dos mails como usuarios de prueba); variables cargadas en Vercel Production.

**Plan aprobado — "pre-gasto"** (sacar foto ahora, completar después), en etapas: (0) login con Google — hecho; (1) pendientes con foto — en producción desde 2026-10-05 (PR #10; Blob store privado conectado, verificado por el usuario desde el celular); (2) lectura del ticket con IA para precompletar — **pospuesta por el usuario (2026-10-05)**; cuando se retome: modelo más barato (Claude Haiku 4.5), API key de Anthropic en Vercel como `ANTHROPIC_API_KEY` (que el usuario la cargue directo, no por el chat) y con límite de gasto mensual; (3) notificación push diaria (service worker + tarea diaria de Vercel; en iPhone solo con la app instalada). Solo Google como proveedor de login (Apple requiere cuenta paga de developer).

**Problema resuelto (2026-10-05) — pantallas de la app instalada que "parecían navegador":** no era el login. El manifest no tenía `scope`, así que el navegador lo derivaba de `start_url` (`/expenses/`) y todas las páginas fuera de esa ruta (home, dashboard, pendientes, categorías, login) se abrían con interfaz de navegador. Se agregó `scope: "/"` y las fotos dejaron de abrirse con `target="_blank"` (también sacaba de la app): ahora usan `components/PhotoViewer.tsx`. Las apps ya instaladas toman el manifest nuevo al reinstalarlas (iOS lo fija al instalar; Android lo actualiza solo, pero puede tardar).

**Idea anotada por el usuario (2026-10-05) — "gasto por audio":** dictar "gasté 3.500 en el súper ayer" y que quede cargado. Encaja con el pre-gasto: el audio es otra forma de captura. Enfoque propuesto, sin implementar: dictado con la Web Speech API del navegador (`SpeechRecognition`, `lang: "es-AR"`; gratis, funciona en Chrome Android y Safari iOS) → texto → Claude Haiku 4.5 extrae monto, categoría, fecha y detalle → se abre el formulario de carga precompletado para confirmar. Claude no recibe audio directo, por eso la transcripción va en el navegador. Si el dictado no está disponible o no hay conexión, guardar la grabación como pendiente y procesarla después.

**Próximos pasos:** el usuario está eligiendo del backlog (la etapa 2 del pre-gasto quedó pospuesta). No arranques otros ítems del backlog sin que el usuario elija. Siguen recomendados: moneda ARS/USD, cuotas, dashboard mensual, clasificación fijo/variable/prescindible.

### Backlog (sin priorizar por el usuario todavía)

- **Deploy/datos:** la base de Preview no se migra sola (`DATABASE_URL` de Preview es una variable distinta de la de Production; no está confirmado si apuntan a la misma base); backups; sacar `log: ["query"]` de `lib/prisma.ts` en prod.
- **Carga (pendiente del paquete de pulido):** medio de pago (el usuario no lo pidió todavía); crear categoría desde el formulario; agregar/cambiar la foto de un gasto ya cargado.
- **Prolijidad:** no hay tests (`parseAmount` es buen candidato para empezar).
- **Carga:** medio de pago; UI para `note` (existe en la base, sin campo en el formulario); gastos fijos/recurrentes con vencimiento; carga sin conexión (service worker + cola local); sugerencias al cargar (autocompletar detalle con categoría, gastos frecuentes como atajos); **gasto por audio** (ver la idea anotada en Estado actual); importar resúmenes de tarjeta/banco.
- **Análisis:** categorías marcadas fijo/variable/prescindible; subcategorías o etiquetas; búsqueda; equivalente en USD por fecha (inflación).
- **Ahorro:** ingresos y tasa de ahorro; presupuestos por categoría con alertas; metas de ahorro; exportar CSV/Excel.
- **Household (pedido por el usuario, 2026-10-05):** hoy todos los mails de `ALLOWED_EMAILS` ya comparten un único conjunto de datos. Lo que falta: gestionar miembros desde la app (invitar/quitar sin tocar variables de Vercel) y, si hace falta, varios hogares separados (modelo `Household` + `householdId` en gastos, categorías y pendientes). Aclarar con el usuario cuál de las dos cosas necesita antes de diseñar.
- **Pareja:** quién cargó cada gasto — hecho (se muestra en el listado). No hace falta balance entre ellos: es caja común.

## Arquitectura

- **Datos** (`prisma/schema.prisma`): `Expense` (`title`, `amount` `Decimal(12,2)`, `categoryId` → `Category`, `date` `DATE`, `currency` `"ARS"`/`"USD"`, `note` sin UI, `receiptUrl`, `installmentGroupId`/`installmentNumber`/`installmentCount` para cuotas, `createdBy`/`createdByName` de la sesión de Google — null en gastos anteriores al login), `Category` (`name` único) y `PendingExpense` (ver Pendientes). Cliente Prisma singleton en `lib/prisma.ts` (alias `@/*` = raíz del repo).
- **Auth** (`middleware.ts`, `lib/auth.ts`, `lib/allowlist.ts`): todo exige sesión salvo `/login`, `/api/auth/*`, `_next`, el manifest y `/icons`. Sin sesión, las páginas redirigen a `/login?callbackUrl=…` y la API responde 401. La allowlist (`ALLOWED_EMAILS`) se chequea al loguear **y** en cada request, así sacar un mail revoca el acceso aunque la sesión siga vigente. Sesión JWT de 180 días, sin tablas. Variables documentadas en `.env.example`.
- **API** (route handlers en `app/api/`):
  - `expenses` — `GET` lista con `category`, orden `date desc`, filtros opcionales `categoryId`/`from`/`to`; `POST` crea (con `pendingId` opcional, ver Pendientes; con `installments` 2–60 crea una fila por cuota, ver Decisiones). `expenses/[id]` — `GET`/`PATCH` (cualquier subconjunto de campos; editar una cuota afecta solo a esa)/`DELETE` (con `?scope=group` borra todas las cuotas de la compra; borra la foto solo si ningún otro gasto la usa). `POST`/`PATCH` validan con `parseExpenseInput` (`lib/validation.ts`) → 400. Las respuestas pasan por `serializeExpense` (`lib/serialize.ts`) para que `amount` sea número.
  - `categories` — lista (con `expenseCount`), crea, renombra; `DELETE` da 409 si tiene gastos; `POST categories/[id]/merge {targetId}` mueve los gastos y borra la original en una transacción.
  - `pending`, `pending/[id]`, `photos/[...key]` — ver Pendientes y Fotos.
  - `suggestions` — detalles ya usados (sin contar cuotas repetidas ni detalles iguales al nombre de la categoría), con cantidad de usos y la última categoría. Alimenta el autocompletado y los atajos "Frecuentes".
  - `POST expenses` responde **409 con `duplicate`** si ya existe un gasto con el mismo monto, moneda, categoría y día (no en cuotas); el cliente confirma y reintenta con `allowDuplicate: true`.
- **Páginas** — todas client components (`"use client"`) que hacen `fetch` en `useEffect` y filtran/agregan en el cliente:
  - `/` — total del mes, cartel de pendientes, "Cargar gasto" + botón 📷, últimos 5 gastos.
  - `/expenses` — tarjetas agrupadas por día (con total del día por moneda), filtros de categoría y mes (en el cliente), quién lo cargó y 📎 si tiene foto; tocar un gasto lo edita. Eliminar está en la pantalla de edición (`lib/deleteExpense.ts`, que pregunta cuota sola o todas).
  - `/expenses/new`, `/expenses/[id]/edit` — ambas usan `components/ExpenseForm.tsx`: carga rápida con monto grande arriba, categorías como botones ordenadas por uso, fecha Hoy/Ayer/otra y acciones fijas abajo. En el alta, "Guardar y otro" remonta el form (cambiando `key`) y muestra un aviso con "Deshacer". Con `?pending=<id>` completa un pendiente. En el alta normal hay "📷 Foto del ticket" (`allowPhoto`): la foto adjunta se sube primero como pendiente y el gasto se crea con `pendingId` (mismo camino que completar un pendiente, así queda como `receiptUrl`, también en cuotas); con foto adjunta aparece "Guardar como pendiente" (`onSaveAsPending`), que guarda foto + monto + detalle para completar después.
  - `/dashboard` — por mes (flechas ‹ › o tocando una barra): total con variación vs mes anterior y vs promedio de los 3 meses previos (solo los que tienen gastos), ranking de categorías con % y variación por categoría, los 5 gastos más grandes y barras de los últimos 12 meses con el mes elegido resaltado. Una moneda por vez (pestañas ARS/USD si hay gastos en USD).
  - `/categories` — agregar, renombrar, unir y borrar.
  - `/pending` — capturar y listar pendientes.
  - `/login` — botón de Google; muestra "sin acceso" si la cuenta no está en la allowlist.
- **Layout** (`app/layout.tsx`): `Header` (título y "Salir"; links solo en desktop) y `BottomNav` (solo celular: Inicio · Gastos · **+** · Dashboard · Pendientes con globito; se oculta en `/login` y en las pantallas del formulario, que fijan sus propios botones abajo).
- **Pendientes ("pre-gasto")**: `PendingExpense` (foto, monto y nota opcionales, `createdBy`) está separado de `Expense` para que nunca entre en totales ni gráficos. `components/CaptureButton.tsx` usa un input de archivo **sin** `capture`, así el teléfono ofrece cámara o galería (sirve para capturas de Mercado Pago o home banking). Comprime en el cliente (`lib/compressImage.ts`: lado máximo 1600 px, JPEG 0,75 → ~150-400 KB) y sube a `POST /api/pending` (multipart). "Completar" abre `/expenses/new?pending=<id>` con la foto, el monto, la nota y la fecha de captura precargados. `POST /api/expenses` con `pendingId` crea el gasto y borra el pendiente en una transacción, y la foto pasa a `receiptUrl`. El contador (`lib/usePendingCount.ts`, refrescado con `notifyPendingChanged()`) alimenta el globito y el cartel.
- **Fotos** (`lib/photos.ts`): en producción, en un Vercel Blob **privado**. Nunca se expone la URL del blob: se sirven por `/api/photos/<key>`, detrás del login. En la base se guarda la key (`photoKey`) o la URL de la app (`receiptUrl` = `/api/photos/receipts/<uuid>.jpg`). En Vercel, conectar el store al proyecto crea `BLOB_STORE_ID` (no `BLOB_READ_WRITE_TOKEN`) y el SDK se autentica con el token OIDC del deploy; el código acepta cualquiera de las dos. Si hay `BLOB_READ_WRITE_TOKEN` se pasa explícito: con `BLOB_STORE_ID` también presente, el SDK intentaría OIDC, que Vercel no emite para "development" (`OIDC is enabled for this project, but not for the "development" environment`). Sin ninguna se guardan en `./.uploads` (gitignoreado); en Vercel sin store falla a propósito. **El `.env` local del usuario apunta al store real** (decisión suya): las pruebas locales escriben fotos reales, así que borrar todo lo que se cree al probar. Borrar un gasto o descartar un pendiente borra su foto.
- **PWA**: `app/manifest.ts` (`start_url: /expenses/new`, `scope: "/"`, con atajos) e íconos en `public/icons/` (generados con ImageMagick: "$" blanco sobre `#3987e5`). `viewport-fit=cover` + `env(safe-area-inset-*)` en las barras fijas. Sin service worker: no funciona sin conexión.
- **Helpers del cliente** (`lib/format.ts`): `formatMoney`, `formatAmount` (con el signo de la moneda: `$` o `US$`), `expenseTitle` (agrega "2/6" a las cuotas), `formatDate`, `monthKey`, `monthLabel`, `todayISO`, `daysAgoISO`, `toLocalISODate`, `parseAmount` y `toAmountInput`. `lib/expenses.ts` tiene solo tipos (`Expense`, `Category`, `PendingExpense`).

## Decisiones de arquitectura clave

- **`date` es `DATE`, no timestamp.** Un gasto es de un día calendario. Con timestamp, `"2026-09-26"` se guardaba como medianoche UTC y en Argentina (UTC-3) se mostraba el 25 y los gastos del día 1 caían en el mes anterior. La API sigue devolviendo `"YYYY-MM-DDT00:00:00.000Z"`, por eso en el cliente **se lee el día del string** (`lib/format.ts`) y nunca se pasa por `new Date()` para mostrar o agrupar.
- **`amount` es `Decimal(12,2)`** para no acumular errores de punto flotante en totales. Prisma devuelve `Decimal`, que en JSON sale como string: toda respuesta de gastos pasa por `serializeExpense` para que `amount` llegue como número.
- **Categorías en tabla, editables por el usuario.** Antes cada página tenía su propia lista hardcodeada y no coincidían (p. ej. `house` solo existía en el alta). Borrar una categoría con gastos se rechaza (409) en vez de cascada, para no perder datos.
- **Migraciones con datos se escriben a mano.** `prisma migrate dev` genera `DROP COLUMN` + `ADD COLUMN NOT NULL`, que pierde datos y falla con tablas no vacías. Generar con `--create-only`, reescribir el SQL para hacer backfill (ver la migración `categories_decimal_date`), y probarlo sobre una base aparte con datos en el formato viejo antes de aplicarlo.
- **Migraciones en el build, solo en producción y después de compilar** (`npm run build` → `prisma generate && next build && migrate:production`). Compilar primero hace que un build roto no toque la base; si `migrate deploy` falla, el deploy falla y producción sigue con la versión anterior. Las previews no migran para no tocar bases compartidas.
- **Las categorías por defecto se siembran en la migración** (no hay seed script), así cualquier base nueva queda usable.
- **next-auth v4 (estable), no v5** (en beta al 2026-10). En Vercel Production hay que fijar `NEXTAUTH_URL` a la URL pública: sin eso v4 usa `VERCEL_URL` (la URL propia de cada deploy) y Google rechaza el `redirect_uri`. El login no funciona en las previews (URL distinta, no registrada en Google); las previews ya están detrás de la protección de Vercel.
- **Cuotas = un `Expense` por mes.** El usuario carga el **total** (con el interés ya incluido, no se calcula nada) y la cantidad; `lib/installments.ts` reparte los centavos sobrantes en las primeras cuotas (la suma da exacto) y suma meses con tope al último día (31/1 → 28/2). El `title` se guarda sin sufijo; "Heladera 2/6" lo arma `expenseTitle`. Las cuotas comparten la foto (`receiptUrl`). Las cuotas futuras cuentan en los meses que vienen ("Cuotas a futuro" en la home) y se excluyen de "Últimos gastos" (la API ordena por fecha desc y quedarían arriba).
- **Monedas separadas, nunca convertidas.** Solo `ARS` y `USD` (`CURRENCIES` en `lib/validation.ts`); USD se usa sobre todo para suscripciones. Totales de la home por moneda; el dashboard muestra una moneda por vez con pestañas que aparecen solo si hay gastos en USD. Decisión del usuario: ver separado alcanza, sin cotización.
- **Montos tipeados en formato argentino.** El input de monto es `type="text" inputMode="decimal"` (no `type="number"`, que según el teclado rechaza la coma) y se interpreta con `parseAmount` (`lib/format.ts`): coma = decimal, puntos = miles; sin coma, un punto seguido de exactamente 3 dígitos es de miles (`1.500` → 1500), si no es decimal (`12.5`). La API recibe siempre un número.
- **Duplicados se chequean en el servidor**, no en el cliente: así detecta también lo que cargó la otra persona desde su teléfono. Si se cancela y había foto adjunta, el cliente borra el pendiente que subió para esa foto.
- **Título opcional en la UI:** si queda vacío, el form manda el nombre de la categoría. La API sigue exigiendo `title` (el default lo pone el cliente).
- **Dashboard sin paleta categórica:** el ranking de categorías es una lista HTML con barras de un solo color (`#3987e5`, validado contra `#2b2b2b`) — con 9+ categorías una torta repetiría colores y la lista se lee mejor en el celular. En el gráfico de 12 meses el mes elegido va en azul y el resto en gris (`#4b5563`). Variaciones: subir el gasto es lo malo → ▲ rojo / ▼ verde, siempre con flecha y signo (no solo color).
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
- **PWA instalada**: cualquier página fuera del `scope` del manifest, o cualquier link con `target="_blank"`, se abre con interfaz de navegador. No usar `target="_blank"` para contenido propio (para fotos, `PhotoViewer`). Si se cambia `start_url`, mantener `scope: "/"` explícito. El login con Google siempre pasa un momento por `accounts.google.com` (otro dominio): eso es esperable.
- **`params` es una Promise** en los route handlers de Next 15: tiparlo `{ params: Promise<{ id: string }> }` y hacer `await`.
- **Fechas:** ver Decisiones. Para el valor por defecto de un `<input type="date">` usar `todayISO()`, no `toISOString()` (de noche da la fecha de mañana).
- **Tailwind:** v4 vía `@import "tailwindcss"` en `app/globals.css`; no hay `tailwind.config.js` ni modo claro. Las clases propias de `globals.css` no admiten variantes (`hover:bg-secundario` no funciona): para hover usar utilidades de Tailwind (p. ej. `hover:bg-neutral-800`).
- **Frenar el dev server:** `pkill -f "next dev"` en un comando de shell **aparte**. Si el patrón aparece en el mismo comando que otras cosas, `pkill -f` también mata a ese shell (exit 144) y lo que sigue no corre.
- **`npm run build` con `npm run dev` corriendo** pisa `.next` y el dev server empieza a dar 500. Reiniciarlo con `rm -rf .next && npm run dev -- -p 3100`.
- **Probar en "celular":** Playwright con `executablePath: "/usr/bin/chromium-browser"` (la versión de navegador de Playwright no está instalada), viewport 390×844, `isMobile` y `hasTouch`. Recharts anima las barras al entrar: esperar ~2s antes de capturar el dashboard.
