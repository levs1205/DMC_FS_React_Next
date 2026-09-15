# Reservas — Next.js 16 + Prisma + Postgres

Proyecto educativo: sistema de reservas de hotel con autenticación por JWT,
cobros con Mercado Pago, un asistente conversacional sobre los datos y
observabilidad completa (logs, métricas y trazas).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y rellena los valores
npm run db:migrate             # aplica las migraciones al Postgres local
npm run dev
```

Abre <http://localhost:3000>.

`.env.example` documenta cada variable: qué es, si es obligatoria y cómo
generarla.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint (ya no corre dentro de `build` en Next 16) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:all` | typecheck + lint + build. Lo mismo que valida el despliegue |
| `npm run db:migrate` | Crea y aplica una migración (desarrollo) |
| `npm run db:migrate:deploy` | Aplica migraciones existentes (servidores) |
| `npm run db:studio` | Explorador visual de la base |
| `npx prisma migrate reset` + `npx prisma db seed` | Reconstruye la base local desde cero. **Borra todos los datos** |
| `npm run db:verify` | Ensayo general: aplica las migraciones y el seed sobre una base vacía desechable y comprueba que reproducen `schema.prisma` |
| `npm run db:hash -- "clave"` | Genera el hash de una contraseña y el `UPDATE` para aplicarlo |
| `npm run deploy` | Despliega esta carpeta a una URL de **preview** |
| `npm run deploy:prod` | Despliega a **producción** |
| `npm run env:pull` | Baja las variables de Vercel a `.env.local` |

## Desplegar

Desde esta carpeta, sin pasar por GitHub:

```bash
npx vercel login       # solo la primera vez
npx vercel link        # solo la primera vez
npm run deploy         # preview: URL desechable
npm run deploy:prod    # producción
```

El detalle completo —base de datos, variables por entorno, migraciones,
dominio, webhooks y rollback— está en
**[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**.

## Estructura

```
app/            rutas, páginas y route handlers
  api/          endpoints REST (+ /api/health y /api/metrics)
modules/        lógica de negocio, por dominio: auth, bookings, rooms,
                payments, analytics, chat, users
lib/
  config/       configuración de entorno validada
  db/           cliente de Prisma, instrumentado
  http/         envoltorios y utilidades de los route handlers
  observability/ logger, métricas, trazas, contexto de request
  seo/          metadatos y datos estructurados
prisma/         esquema, migraciones y seed
docs/           guías de despliegue y observabilidad
proxy.ts        control de acceso antes de cada navegación
instrumentation.ts  arranque de OpenTelemetry
```

Cada capa tiene una responsabilidad: los route handlers validan y responden,
los servicios deciden, los repositorios consultan. La base de datos solo se toca
desde un repositorio.

## Endpoints de diagnóstico

```bash
curl http://localhost:3000/api/health     # ¿viva? ¿llega a Postgres?
curl http://localhost:3000/api/metrics    # métricas en formato Prometheus
```

Cada respuesta de la API lleva `x-request-id` y `Server-Timing`, y cada error
devuelve ese mismo id en el cuerpo. Es la llave para encontrar un incidente
concreto entre todos los logs.

## Documentación

- **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)** — desplegar en Vercel con Neon
  Postgres desde la terminal, paso a paso: entornos, variables, migraciones,
  dominio, webhooks, rollback y checklist. Incluye el flujo alternativo por
  GitHub.
- **[docs/OBSERVABILIDAD.md](docs/OBSERVABILIDAD.md)** — cómo están montados los
  logs, las métricas y las trazas, cómo leerlos cuando algo falla y cómo
  instrumentar código nuevo.

## Notas de la versión de Next

Este proyecto usa **Next.js 16**, que trae cambios respecto a lo que suele
encontrarse en tutoriales:

- El *middleware* se llama ahora **proxy** (`proxy.ts`) y corre en el runtime de
  Node por defecto.
- ESLint ya no se ejecuta dentro de `next build`: es un paso aparte.
- La documentación de la versión exacta está en `node_modules/next/dist/docs/`.
