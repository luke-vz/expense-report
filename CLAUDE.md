# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

App para registrar los gastos del hogar de una pareja con **caja común** (gastos e ingresos compartidos). El objetivo de producto es **entender en qué se va la plata para armar un plan de ahorro**; toda funcionalidad nueva se evalúa contra eso. Se usa sobre todo desde el celular, instalada como app (PWA), publicada en Vercel: https://expense-report-mu.vercel.app

Stack: Next.js 15 (App Router, Turbopack) + React 19, Prisma 6 sobre PostgreSQL, Tailwind CSS v4, Recharts, next-auth v4 (Google), Vercel Blob. UI en castellano rioplatense.

## Estado actual (2026-10-05)

**En producción:** carga rápida de gastos (cuotas, ARS/USD, foto del ticket, **por voz con IA**), "pre-gastos" (foto ahora, completar después), login con Google restringido a dos mails, app instalable, dashboard por mes y gestión de categorías. El último PR mergeado es el #18 (gasto por voz); verificar con `gh pr list` si hay alguno abierto.

**La base de producción TIENE DATOS REALES** (cientos de gastos desde 2025) y no se puede resetear. Claude no tiene acceso a sus credenciales: cualquier operación directa sobre esa base la hace el usuario. Las migraciones las aplica el build de producción (ver Decisiones).

**Foco y decisiones del usuario — respetarlas:**
- El foco actual es **pulir la carga de gastos**.
- **Ahorro y presupuestos (ingresos, tasa de ahorro, topes por categoría, metas) están en pausa** por decisión del usuario: no proponerlos hasta que los pida.
- **IA:** en uso para el **gasto por voz** (PR #18); la lectura de tickets con IA sigue pospuesta. Reglas para cualquier uso de IA: modelo más barato (Claude Haiku 4.5), `ANTHROPIC_API_KEY` cargada por el usuario directo en Vercel (nunca pegada en el chat) y con límite de gasto mensual.
- **La carga no puede sumar pasos.** La vara es: atajo de Frecuentes + monto + Guardar (~3 toques). El dictado por teclado (PR #16) se revirtió (PR #17) porque el usuario lo encontró complejo: campo extra + micrófono del teclado + "Completar" + revisar sumaban pasos.
- No arrancar ítems del backlog sin que el usuario elija.
- Formato de montos `$1,500.00`: decidido, no proponer `$1.500,00`. Solo login con Google (Apple requiere cuenta paga de developer). Monedas separadas, sin cotización.

### Backlog

- **Carga (foco actual):**
  - crear una categoría desde el formulario;
  - agregar o cambiar la foto de un gasto ya cargado;
  - campo de nota (existe en la base, sin UI);
  - medio de pago (sugerido, el usuario no lo pidió todavía);
  - gastos fijos/recurrentes con vencimiento;
  - importar resúmenes de tarjeta/banco;
  - carga sin conexión (service worker + cola local).
- **Pre-gasto, etapas que faltan:** (2) lectura del ticket con IA (pospuesta); (3) notificación push diaria de pendientes (service worker + tarea diaria de Vercel; en iPhone solo con la app instalada).
- **Análisis:** categorías marcadas fijo/variable/prescindible; subcategorías o etiquetas; búsqueda por texto; equivalente en USD por fecha (inflación).
- **Ahorro (en pausa):** ingresos y tasa de ahorro; presupuestos por categoría con alertas; metas de ahorro; exportar CSV/Excel.
- **Household (pedido del usuario):** hoy todos los mails de `ALLOWED_EMAILS` ya comparten un único conjunto de datos. Falta gestionar miembros desde la app (invitar o quitar sin tocar variables de Vercel) y, si hiciera falta, varios hogares separados (modelo `Household` + `householdId` en gastos, categorías y pendientes). Aclarar con el usuario cuál de las dos cosas necesita antes de diseñar.
- **Técnico:**
  - la base de Preview no se migra sola (`DATABASE_URL` de Preview es otra variable; no está confirmado si es otra base);
  - backups de la base de producción;
  - sacar `log: ["query"]` de `lib/prisma.ts` en producción;
  - no hay tests (`parseAmount`, `splitAmount`/`addMonths` y `shiftMonth` son buenos candidatos).

### Historial (PRs a `main`)

| PR | Cambio |
|---|---|
| #5 | Next 15.5.27 por seguridad |
| #6 | Categorías en tabla, `Decimal`, `DATE`, migraciones en el build |
| #7 | Unir categorías, validación de la API |
| #8 | Carga rápida mobile y PWA |
| #9 | Login con Google |
| #10 | Pendientes con foto |
| #11 | `scope` del manifest |
| #12 | Cuotas y ARS/USD |
| #13 | Foto en Nuevo gasto |
| #14 | Dashboard por mes |
| #15 | Pulido de la carga: sugerencias, frecuentes, duplicados, quién cargó, listado por día |
| #16 | Dictado por teclado sin IA — **revertido en #17** (sumaba pasos) |
| #17 | Revierte #16 |
| #18 | Gasto por voz con IA: 🎤 de un toque + Claude Haiku |

## Arquitectura

- **Datos** (`prisma/schema.prisma`):
  - `Expense`: `title`, `amount` `Decimal(12,2)`, `categoryId` → `Category`, `date` `DATE`, `currency` `"ARS"`/`"USD"`, `note` (sin UI), `receiptUrl`, `installmentGroupId`/`installmentNumber`/`installmentCount` para cuotas, `createdBy`/`createdByName` de la sesión de Google (null en gastos anteriores al PR #15).
  - `Category`: `name` único.
  - `PendingExpense`: ver Pendientes.

  Cliente Prisma singleton en `lib/prisma.ts`. El alias `@/*` apunta a la raíz del repo.
- **Auth** (`middleware.ts`, `lib/auth.ts`, `lib/allowlist.ts`):
  - Todo exige sesión salvo `/login`, `/api/auth/*`, `_next`, `manifest.webmanifest`, `/icons` y `favicon.ico`. Sin sesión, las páginas redirigen a `/login?callbackUrl=…` y la API responde 401.
  - La allowlist (`ALLOWED_EMAILS`) se chequea al loguear **y** en cada request, así sacar un mail revoca el acceso aunque la sesión siga vigente.
  - Sesión JWT de 180 días, sin tablas. Variables documentadas en `.env.example`.
- **API** (route handlers en `app/api/`):
  - `expenses` — `GET` lista con `category`, orden `date desc`, filtros opcionales `categoryId`/`from`/`to`. `POST` crea; acepta:
    - `pendingId`: completa un pendiente;
    - `installments` (2–60): una fila por cuota;
    - `allowDuplicate`: si ya existe un gasto con el mismo monto, moneda, categoría y día (no en cuotas), responde **409 con `duplicate`**, y el cliente confirma y reintenta con `allowDuplicate: true`.
  - `expenses/[id]` — `GET`/`PATCH`/`DELETE`.
    - `PATCH` acepta cualquier subconjunto de campos; editar una cuota afecta solo a esa.
    - `DELETE` con `?scope=group` borra todas las cuotas de la compra; la foto se borra solo si ningún otro gasto la usa.
  - Validación y serialización de gastos: `POST`/`PATCH` validan con `parseExpenseInput` (`lib/validation.ts`) → 400. Las respuestas pasan por `serializeExpense` (`lib/serialize.ts`) para que `amount` sea número.
  - `categories` — lista (con `expenseCount`), crea y renombra. `DELETE` da 409 si la categoría tiene gastos. `POST categories/[id]/merge {targetId}` mueve los gastos y borra la original en una transacción.
  - `voice` — `POST {text, today}`. Claude Haiku 4.5 convierte una frase en `{amount, currency, date, title, categoryId, installments}`:
    - Usa salida estructurada (`output_config.format` con JSON schema).
    - El prompt incluye las categorías (id: nombre), los últimos ~60 detalles con su categoría (para aprender los hábitos de la casa) y la fecha de hoy, que manda el cliente: el servidor está en UTC y de noche iría un día adelantado.
    - La respuesta del modelo **se valida** antes de devolverla: montos positivos, categoría existente, fecha no futura y cuotas entre 2 y 60.
    - Sin `ANTHROPIC_API_KEY` responde 503. No guarda nada.
  - `suggestions` — detalles ya usados (sin cuotas repetidas ni detalles iguales al nombre de la categoría), con cantidad de usos y la última categoría. Alimenta el autocompletado y los atajos "Frecuentes".
  - `pending`, `pending/[id]`, `photos/[...key]` — ver Pendientes y Fotos.
- **Páginas** — todas client components (`"use client"`) que hacen `fetch` en `useEffect` y filtran/agregan en el cliente:
  - `/` — total del mes por moneda, "Cuotas a futuro", cartel de pendientes, "Cargar gasto" + 📷 y últimos 5 gastos (sin cuotas futuras).
  - `/expenses` — tarjetas agrupadas por día con el total del día por moneda; filtros de categoría y mes; muestra quién lo cargó y 📎 si tiene foto. Tocar un gasto lo edita.
  - `/expenses/new` y `/expenses/[id]/edit` — ver Formulario de carga.
  - `/dashboard` — un mes a la vez (‹ › o tocando una barra):
    - total con variación vs el mes anterior y vs el promedio de los 3 meses previos (solo los que tienen gastos);
    - ranking de categorías con % y variación por categoría;
    - los 5 gastos más grandes;
    - barras de los últimos 12 meses con el mes elegido resaltado.

    Una moneda por vez: pestañas ARS/USD si hay gastos en USD.
  - `/categories` — agregar, renombrar, unir y borrar (en el celular se llega desde `/expenses`).
  - `/pending` — capturar y listar pendientes.
  - `/login` — botón de Google; muestra "sin acceso" si la cuenta no está en la allowlist.
- **Formulario de carga** (`components/ExpenseForm.tsx`, el único formulario de gastos):
  - Diseño: monto grande arriba con ARS/USD, categorías como botones ordenadas por uso, detalle opcional, fecha Hoy/Ayer/otra y acciones fijas abajo.
  - Props opcionales:
    - `allowVoice`: botón "🎤 Decí el gasto" (`components/VoiceButton.tsx`) — ver abajo;
    - `showShortcuts`: atajos "Frecuentes" (los 5 detalles más usados con 2 usos o más; completan detalle y categoría y enfocan el monto);
    - `allowInstallments`: selector de cuotas con vista previa;
    - `allowPhoto`: "📷 Foto del ticket" (más abajo);
    - `onSaveAsPending`: "Guardar como pendiente";
    - `onDelete`: "Eliminar gasto";
    - `photoUrl`: foto ya existente.
  - El autocompletado del detalle ignora tildes y mayúsculas, y elegir una sugerencia completa también la categoría.
  - **Voz:**
    1. Un toque en 🎤 arranca la Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, `es-AR`, `continuous: false`, así corta sola al dejar de hablar) y muestra lo que va escuchando.
    2. El texto va a `/api/voice` y el resultado completa el formulario, mostrando "Entendí: …" y qué falta.
    3. Se guarda con Guardar: 2 toques en total.

    Si el navegador no tiene la API, o no hay permiso de micrófono, muestra el motivo en vez de fallar en silencio.
  - En el alta (`app/expenses/new/page.tsx`):
    - "Guardar y otro" remonta el form (cambiando `key`) y muestra un aviso con "Deshacer".
    - Con `?pending=<id>` completa un pendiente.
    - La foto adjunta se sube primero como pendiente y el gasto se crea con `pendingId`. Es el mismo camino que completar un pendiente, así queda como `receiptUrl`, también en cuotas.
    - El 409 de duplicado se confirma con `confirm()`; si se cancela con una foto adjunta, se borra el pendiente subido para esa foto.
  - En la edición, eliminar usa `lib/deleteExpense.ts`, que pregunta si borrar la cuota sola o todas.
- **Layout** (`app/layout.tsx`):
  - `Header`: título y "Salir"; links solo en desktop.
  - `BottomNav`: solo en el celular, con Inicio · Gastos · **+** · Dashboard · Pendientes (con globito). Se oculta en `/login` y en las pantallas del formulario, que fijan sus propios botones abajo.
- **Pendientes ("pre-gasto")**:
  - `PendingExpense` (foto, monto y nota opcionales, `createdBy`) está separado de `Expense` para que nunca entre en totales ni gráficos.
  - Captura: `components/CaptureButton.tsx` usa un input de archivo **sin** `capture`, así el teléfono ofrece cámara o galería (sirve para capturas de Mercado Pago o home banking). Comprime en el cliente (`lib/compressImage.ts`: lado máximo 1600 px, JPEG 0,75 → ~150-400 KB) y sube a `POST /api/pending` (multipart).
  - Completar: abre `/expenses/new?pending=<id>` con la foto, el monto, la nota y la fecha de captura precargados. `POST /api/expenses` con `pendingId` crea el gasto y borra el pendiente en una transacción; la foto pasa a `receiptUrl`.
  - Contador: `lib/usePendingCount.ts`, que se refresca con `notifyPendingChanged()`, alimenta el globito y el cartel de la home.
- **Fotos** (`lib/photos.ts`):
  - En producción viven en un Vercel Blob **privado**. Nunca se expone la URL del blob: se sirven por `/api/photos/<key>`, detrás del login. Se ven dentro de la app con `components/PhotoViewer.tsx`.
  - En la base se guarda la key (`photoKey`) o la URL de la app (`receiptUrl` = `/api/photos/receipts/<uuid>.jpg`).
  - Credenciales: en Vercel, conectar el store crea `BLOB_STORE_ID` y el SDK se autentica con el token OIDC del deploy. Si hay `BLOB_READ_WRITE_TOKEN`, se pasa explícito: con `BLOB_STORE_ID` también presente, el SDK intentaría OIDC, que Vercel no emite para "development".
  - Sin ninguna de las dos variables, las fotos se guardan en `./.uploads` (gitignoreado); en Vercel sin store falla a propósito.
  - **El `.env` local del usuario apunta al store real** (decisión suya): las pruebas locales escriben fotos reales, así que hay que borrar todo lo que se cree al probar.
  - Borrar un gasto o descartar un pendiente borra su foto (si nada más la usa).
- **PWA**: `app/manifest.ts` (`start_url: /expenses/new`, `scope: "/"`, con atajos) e íconos en `public/icons/` (generados con ImageMagick: "$" blanco sobre `#3987e5`). `viewport-fit=cover` + `env(safe-area-inset-*)` en las barras fijas. Sin service worker: no funciona sin conexión.
- **Helpers**:
  - `lib/format.ts`:
    - montos: `formatMoney`, `formatAmount` (con el signo de la moneda: `$` o `US$`), `parseAmount`, `toAmountInput`;
    - fechas: `formatDate`, `monthKey`, `monthLabel`, `shiftMonth`, `currentMonthKey`, `todayISO`, `daysAgoISO`, `toLocalISODate`;
    - títulos: `expenseTitle` (agrega "2/6" a las cuotas).
  - `lib/installments.ts`: `splitAmount`, `addMonths`, `MAX_INSTALLMENTS`.
  - `lib/expenses.ts`: solo tipos (`Expense`, `Category`, `PendingExpense`, `Suggestion`).

## Decisiones de arquitectura clave

- **`date` es `DATE`, no timestamp.** Un gasto es de un día calendario. Con timestamp, `"2026-09-26"` se guardaba como medianoche UTC y en Argentina (UTC-3) se mostraba el 25; además, los gastos del día 1 caían en el mes anterior. La API sigue devolviendo `"YYYY-MM-DDT00:00:00.000Z"`, por eso en el cliente **se lee el día del string** (`lib/format.ts`) y nunca se pasa por `new Date()` para mostrar o agrupar.
- **`amount` es `Decimal(12,2)`** para no acumular errores de punto flotante en totales. Prisma devuelve `Decimal`, que en JSON sale como string: toda respuesta de gastos pasa por `serializeExpense` para que `amount` llegue como número.
- **Categorías en tabla, editables por el usuario.** Antes cada página tenía su propia lista hardcodeada y no coincidían. Borrar una categoría con gastos se rechaza (409) en vez de borrar en cascada; para juntar dos categorías está "Unir con…".
- **Migraciones con datos se escriben a mano.** `prisma migrate dev` genera `DROP COLUMN` + `ADD COLUMN NOT NULL`, que pierde datos y falla con tablas no vacías. Generar con `--create-only`, reescribir el SQL para hacer backfill (ver la migración `categories_decimal_date`) y probarlo sobre una base aparte con datos en el formato viejo antes de aplicarlo. Las migraciones que solo agregan tablas o columnas nullable son seguras tal cual.
- **Migraciones en el build, solo en producción y después de compilar** (`npm run build` → `prisma generate && next build && migrate:production`). Compilar primero hace que un build roto no toque la base; si `migrate deploy` falla, el deploy falla y producción sigue con la versión anterior. Las previews no migran, para no tocar bases compartidas.
- **Las categorías por defecto se siembran en la migración** (no hay seed script), así cualquier base nueva queda usable.
- **next-auth v4 (estable), no v5** (en beta al 2026-10). En Vercel Production hay que fijar `NEXTAUTH_URL` a la URL pública: sin eso, v4 usa `VERCEL_URL` (la URL propia de cada deploy) y Google rechaza el `redirect_uri`. El login no funciona en las previews (URL distinta, no registrada en Google); las previews ya están detrás de la protección de Vercel.
- **Cuotas = un `Expense` por mes.**
  - El usuario carga el **total** (con el interés ya incluido; no se calcula nada) y la cantidad de cuotas.
  - `lib/installments.ts` reparte los centavos sobrantes en las primeras cuotas, así la suma da exacta, y suma meses con tope al último día (31/1 → 28/2).
  - El `title` se guarda sin sufijo; "Heladera 2/6" lo arma `expenseTitle`.
  - Las cuotas comparten la foto.
  - Las cuotas futuras cuentan en los meses que vienen ("Cuotas a futuro" en la home) y se excluyen de "Últimos gastos", porque la API ordena por fecha descendente y quedarían arriba.
- **Monedas separadas, nunca convertidas.** Solo `ARS` y `USD` (`CURRENCIES` en `lib/validation.ts`); USD se usa sobre todo para suscripciones. Los totales siempre se muestran por moneda.
- **Montos tipeados en formato argentino.** El input de monto es `type="text" inputMode="decimal"` (no `type="number"`, que según el teclado rechaza la coma) y se interpreta con `parseAmount`: coma = decimal, puntos = miles. Sin coma, un punto seguido de exactamente 3 dígitos es de miles (`1.500` → 1500); si no, es decimal (`12.5`). La API recibe siempre un número.
- **Voz: transcribir en el navegador, interpretar con IA.** **Confirmado por el usuario en su iPhone, con la app instalada** (2026-10-06): solo pide permisos de micrófono y reconocimiento de voz la primera vez. Si algún día falla en otro dispositivo, el plan B es grabar audio con `MediaRecorder` y transcribir en el servidor; `/api/voice` no cambia porque recibe texto. El dictado por teclado sin IA (#16) se revirtió por sumar pasos. La vara es "un toque y Guardar". Claude no recibe audio, por eso la transcripción la hace el navegador (gratis). Haiku interpreta frases libres ("le pagué 25 lucas a la plomera ayer" → $25.000 · Plomera · Casa · ayer) y usa los hábitos de la casa para elegir la categoría. Cada frase cuesta una fracción de centavo.
- **Duplicados se chequean en el servidor**, no en el cliente: así detecta también lo que cargó la otra persona desde su teléfono.
- **Título opcional en la UI:** si queda vacío, el form manda el nombre de la categoría. La API sigue exigiendo `title`. Por eso `/api/suggestions` ignora los títulos iguales al nombre de la categoría.
- **Dashboard sin paleta categórica:**
  - El ranking de categorías es una lista HTML con barras de un solo color (`#3987e5`, validado contra `#2b2b2b`). Con 9 o más categorías, una torta repetiría colores, y la lista se lee mejor en el celular.
  - En el gráfico de 12 meses, el mes elegido va en azul y el resto en gris (`#4b5563`).
  - Variaciones: que el gasto suba es lo malo → ▲ rojo / ▼ verde, siempre con flecha y signo (no solo color).
  - El promedio de 3 meses ignora los meses sin gastos, para no inflar la comparación mientras la app es nueva.
- **Filtrado y agregación en el cliente:** las páginas traen todos los gastos y filtran en el browser. Alcanza para el volumen de un hogar; no hace falta paginar por ahora.

## Convenciones

- Texto visible al usuario en castellano rioplatense (voseo: "Seleccioná", "¿Seguro que querés…?"). Identificadores de código en inglés.
- Las páginas son client components (`"use client"`) que hacen `fetch` a `/api/...` en `useEffect`. Los tipos compartidos del cliente están en `lib/expenses.ts`; no redeclarar interfaces locales.
- Handlers de API:
  - validar a mano (sin zod; ver `lib/validation.ts`);
  - leer el body con `req.json().catch(() => null)`;
  - envolver las escrituras de Prisma en `try/catch` y devolver `{ error }` con status.

  Los mensajes de error de la API van en inglés; los de la UI, en castellano.
- Formularios de gastos: siempre a través de `components/ExpenseForm.tsx`. Montos con `parseAmount`; para precargar uno existente, `toAmountInput`.
- Mostrar montos con `formatAmount(amount, currency)`, que incluye el signo de la moneda; fechas con los helpers de `lib/format.ts`; títulos de gastos con `expenseTitle`.
- Diseño pensado para el celular primero: verificar a 390 px de ancho. Botones de al menos ~44 px de alto; el color de acción principal es `#3987e5`.
- No anidar `<main>`: el layout ya lo pone; las páginas usan `<div>`.
- No usar `target="_blank"` para contenido propio (saca de la app instalada); para fotos, `PhotoViewer`.
- Estilos: tema oscuro con las clases propias de `app/globals.css` (`bg-secundario`, `bg-input`, `bg-boton`, `border-card`, `header-bg`); reusarlas.
- Git:
  - Cada cambio va en una rama `feature/...` o `fix/...` que sale de `develop`, con PR directo a `main`. Vercel despliega `main` a **Production** y cada rama pusheada como **Preview**.
  - Después de cada merge, llevar `develop` a `main` (fast-forward) y borrar la rama.
  - Mensajes de commit cortos, en inglés, en minúscula.
  - **Sin atribución a IA**: ni `Co-Authored-By` en commits ni "Generated with Claude Code" en los PRs (preferencia del usuario).
- Las descripciones de los PR, en castellano: qué cambia, qué hay que configurar antes de mergear (si algo) y qué se verificó.

## Comandos

```bash
npm run dev -- -p 3100   # dev server (en esta máquina 3000 y 3001 los usan otros proyectos)
npm run build            # prisma generate + next build (+ migrate deploy si VERCEL_ENV=production)
npm run lint             # ESLint (next/core-web-vitals + next/typescript)
npx tsc --noEmit         # chequeo de tipos (no hay script para esto)

npx prisma migrate dev --create-only --name <nombre>   # generar migración para revisarla/editarla
npx prisma migrate dev                                  # aplicar migraciones pendientes en local
npx prisma studio

gh pr list                                             # PRs abiertos
npx vercel inspect <deployment> --logs                 # logs de un deploy (el proyecto está vinculado en .vercel/)
```

No hay tests ni test runner configurado. Las verificaciones se hacen con:
- `tsc`, `eslint` y `next build`;
- pruebas ad hoc de la API con `fetch`/`curl` y una cookie de sesión de desarrollo;
- Playwright en viewport de celular (ver Gotchas).

Hay que borrar todo lo que se cree al probar.

**Probar la voz sin micrófono:** en Playwright, `addInitScript` que reemplace **tanto** `window.SpeechRecognition` como `window.webkitSpeechRecognition` (Chromium trae el primero y el código lo prefiere) por una clase falsa que emita `onresult`/`onend`. `/api/voice` llama a Haiku de verdad con la key del `.env`: cada llamada cuesta una fracción de centavo.

**Probar con sesión sin pasar por Google:** `node --env-file=.env scripts/dev-session-cookie.mjs [email] [nombre]` imprime una cookie firmada con el `NEXTAUTH_SECRET` local (`curl -b "$(...)"` o `context.addCookies` en Playwright). Sin cookie, toda la API da 401.

**Base local:** contenedor de podman `expense-report-pg` (Postgres 17, puerto 5434). `.env` (gitignoreado; plantilla en `.env.example`) con `DATABASE_URL="postgresql://expense:expense@localhost:5434/expense_report"` y las variables de auth y Blob. Si el contenedor no existe:

```bash
podman run -d --name expense-report-pg -e POSTGRES_USER=expense -e POSTGRES_PASSWORD=expense \
  -e POSTGRES_DB=expense_report -p 5434:5432 docker.io/library/postgres:17-alpine
npx prisma migrate dev
```

Si el contenedor existe pero está apagado (pasa después de reiniciar la máquina): `podman start expense-report-pg`.

## Gotchas

- **Cliente de Prisma viejo en dev:** `lib/prisma.ts` cachea el cliente en `global`. Después de `prisma generate`/`migrate dev` hay que **reiniciar `npm run dev`**; si no, aparecen `PrismaClientValidationError` o `Cannot read properties of undefined (reading 'findMany')`.
- **Frenar el dev server:** `pkill -f "next dev"` en un comando de shell **aparte**. Si el patrón aparece en el mismo comando que otras cosas, `pkill -f` también mata a ese shell (exit 144) y lo que sigue no corre.
- **`npm run build` con `npm run dev` corriendo** pisa `.next` y el dev server empieza a dar 500. Frenarlo antes, o reiniciarlo con `rm -rf .next && npm run dev -- -p 3100`.
- **Vercel bloquea el deploy con versiones vulnerables de Next:** el build termina bien, pero el deploy falla con `Vulnerable version of Next.js detected`. Se ve con `npx vercel inspect <deployment> --logs`. Se resolvió subiendo Next a la última 15.5.x; ante un nuevo bloqueo, revisar `npm audit` y subir el patch. Quedan avisos de `postcss` (dentro de Next, solo se arregla con Next 16) y `deepmerge-ts`.
- **PWA instalada:** cualquier página fuera del `scope` del manifest, o cualquier link con `target="_blank"`, se abre con interfaz de navegador (pasó con `scope` sin declarar: se derivaba de `start_url`). Si se cambia `start_url`, mantener `scope: "/"` explícito. Los cambios del manifest llegan a las apps ya instaladas recién al reinstalarlas (iOS) o con demora (Android). El login con Google siempre pasa un momento por `accounts.google.com`: es esperable.
- **`vercel link` crea un `.env.local`** con las variables de Development, y Next le da prioridad sobre `.env`. Si se vuelve a vincular, borrarlo (sin leerlo) para que el dev server no apunte a bases remotas.
- **`params` es una Promise** en los route handlers de Next 15: tiparlo `{ params: Promise<{ id: string }> }` y hacer `await`.
- **Fechas:** ver Decisiones. Para el valor por defecto de un `<input type="date">` usar `todayISO()`, no `toISOString()` (de noche da la fecha de mañana).
- **Tailwind:** v4 vía `@import "tailwindcss"` en `app/globals.css`; no hay `tailwind.config.js` ni modo claro. Las clases propias de `globals.css` no admiten variantes (`hover:bg-secundario` no funciona): para hover, usar utilidades de Tailwind (p. ej. `hover:bg-neutral-800`).
- **Probar en "celular":** Playwright con `executablePath: "/usr/bin/chromium-browser"` (la versión de navegador de Playwright no está instalada), viewport 390×844, `isMobile` y `hasTouch`. Recharts anima las barras al entrar y los chips tienen `transition-colors`: esperar antes de capturar (~2 s en el dashboard).
- **Editar este archivo con scripts:** verificar que cada reemplazo se aplicó (por ejemplo, con `assert` en Python). Un reemplazo que no encuentra el texto falla en silencio; así se perdió una vez la sección de Arquitectura.
