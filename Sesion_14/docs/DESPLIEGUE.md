# Despliegue en producción (Vercel + Neon Postgres)

Guía paso a paso para poner esta aplicación en producción **desde la línea de
comandos**, sin pasar por GitHub. Está escrita para seguirse de arriba abajo la
primera vez; después sirve de referencia.

**Tiempo estimado la primera vez:** entre 30 y 45 minutos.
**Costo:** cero. Todo cabe en el plan gratuito de Vercel (Hobby) y en el free
tier de Neon. Lo único que puede costar es un dominio propio, y es opcional.

---

## Índice

1. [Antes de empezar](#1-antes-de-empezar)
2. [Los tres entornos](#2-los-tres-entornos)
3. [CLI o GitHub: cuál conviene aquí](#3-cli-o-github-cuál-conviene-aquí)
4. [Conectar la carpeta con Vercel](#4-conectar-la-carpeta-con-vercel)
5. [Crear la base de datos en Neon](#5-crear-la-base-de-datos-en-neon)
6. [Configurar las variables de entorno](#6-configurar-las-variables-de-entorno)
7. [Las migraciones](#7-las-migraciones)
8. [Desplegar](#8-desplegar)
9. [Verificar el despliegue](#9-verificar-el-despliegue)
10. [Cargar los datos iniciales](#10-cargar-los-datos-iniciales)
11. [Dominio propio](#11-dominio-propio)
12. [Mercado Pago en producción](#12-mercado-pago-en-producción)
13. [Operar: panel web y terminal](#13-operar-panel-web-y-terminal)
14. [Checklist final](#14-checklist-final)
15. [Problemas frecuentes](#15-problemas-frecuentes)
16. [Apéndice: desplegar desde GitHub](#16-apéndice-desplegar-desde-github)

---

## 1. Antes de empezar

Necesitas dos cuentas, las dos gratuitas:

| Cuenta | Para qué | Dónde |
| --- | --- | --- |
| Vercel | Hospedar la aplicación | vercel.com |
| Neon | Postgres administrado | Se crea desde Vercel, no hace falta ir aparte |

GitHub **no** es obligatorio para desplegar. Sí es muy recomendable tener el
código en git de todas formas, aunque sea solo local: el despliegue etiqueta
cada versión con el hash del commit, y sin eso se pierde la trazabilidad entre
"esto empezó a fallar" y "esto se desplegó".

Comprueba que el proyecto está sano **antes** de intentar desplegarlo. Son dos
comandos y comprueban cosas distintas:

```bash
npm run check:all     # ¿compila? typecheck + lint + build
npm run db:verify     # ¿la base se construye desde cero?
```

Si el primero falla en tu máquina, va a fallar en Vercel. Arréglalo primero:
depurar un build roto en el servidor de otro es mucho más lento.

El segundo merece una explicación, porque comprueba algo que casi nadie mira
hasta que es tarde. Que las migraciones funcionen en TU base **no** demuestra
que funcionen en una base nueva:

- Tu base local lleva meses de historia: se creó a mano, se le aplicaron
  migraciones por encima, alguien tocó una columna desde un cliente SQL.
  Funciona, pero no es *el resultado de las migraciones*.
- La base de producción nace **vacía**. Lo único que la construye son los
  archivos de `prisma/migrations`, aplicados en orden, de una sentada.

`npm run db:verify` hace el ensayo general en tu máquina, sobre bases
desechables que crea y borra (`<DB_NAME>_verify` y `<DB_NAME>_verify_shadow`).
Nunca toca tu base de trabajo. En orden:

1. Crea una base vacía.
2. Le aplica las migraciones exactamente como hará Vercel.
3. Compara el resultado con `schema.prisma`. Si sobra o falta algo —el caso
   clásico es haber editado el modelo sin generar la migración— falla y dice
   qué falta.
4. Ejecuta `seed.sql` encima, para comprobar que también funciona sobre una
   base recién creada y no solo sobre la tuya, que ya tenía datos.
5. Comprueba que queda al menos un usuario: una base sin cuentas es un sitio
   en el que nadie puede entrar.

Salida esperada:

```
✔ Todo correcto. Las migraciones y el seed construyen la base desde cero.
```

Y cuando algo falta:

```
[*] Changed the `room` table
  [+] Added column `floor_number`

✖ Las migraciones NO reproducen schema.prisma.
Falta generar una migración: npm run db:migrate
```

---

## 2. Los tres entornos

Esta es la idea que sostiene todo lo demás, así que vale la pena tenerla clara
antes de tocar un botón.

| | `development` | `preview` | `production` |
| --- | --- | --- | --- |
| **Dónde corre** | Tu máquina | Vercel, URL desechable | Vercel, el dominio real |
| **Cómo se crea** | `npm run dev` | `npm run deploy` | `npm run deploy:prod` |
| **Base de datos** | Postgres local | Neon, datos de prueba | Neon, datos reales |
| **Mercado Pago** | Credenciales de PRUEBA | Credenciales de PRUEBA | Credenciales REALES |
| **Variables** | `.env.local` | Vercel › Preview | Vercel › Production |

Las dos reglas que no se rompen:

1. **Un preview nunca toca la base de producción.** Un preview existe para
   probar cosas: alguien va a cancelar una reserva "a ver qué pasa". Si esa
   reserva es real, el experimento le cuesta dinero a alguien.
2. **Los secretos no se comparten entre entornos.** Cada entorno tiene sus
   propios `JWT_*`. Si el secreto de desarrollo —que circula por chats,
   capturas y repos— es el mismo que el de producción, cualquiera que lo haya
   visto puede firmar una sesión de administrador en el sitio real.

El código conoce esta distinción: `lib/config/env.ts` expone `appEnv`, que sale
de `VERCEL_ENV` y vale `development`, `preview` o `production`. Ojo con no
confundirlo con `NODE_ENV`, que en preview y en producción vale `production` en
los dos casos y por eso no sirve para distinguirlos.

---

## 3. CLI o GitHub: cuál conviene aquí

Vercel admite dos formas de desplegar y **no hay ninguna obligación de usar
GitHub**:

| | **CLI** (`npm run deploy:prod`) | **GitHub** (push y despliega) |
| --- | --- | --- |
| Qué sube | El contenido de la carpeta actual | Lo que haya en la rama |
| Cuándo despliega | Cuando tú lo dices | Automático en cada push |
| Preview por PR | Manual, con `npm run deploy` | Automático |
| Configuración inicial | Un `vercel link` | Conectar repo + Root Directory |
| Requiere repo remoto | No | Sí |

**Para este proyecto conviene el CLI**, y no por gusto: este repositorio es un
**monorepo de sesiones** (`Sesion_01`, `Sesion_02`, … `Sesion_14`) y la
aplicación es solo la subcarpeta `Sesion_14`. Por GitHub habría que configurar
el *Root Directory* del proyecto y además frenar los rebuilds que dispararía
cualquier cambio en las otras sesiones. Desde el CLI, la carpeta en la que estás
parado **es** la raíz del proyecto, y no hay nada de eso que configurar.

Si aun así prefieres el flujo por GitHub, está en el
[apéndice](#16-apéndice-desplegar-desde-github).

### Qué se sube exactamente

El CLI empaqueta la carpeta actual respetando `.gitignore` (o `.vercelignore`,
si existe). O sea: **no** se suben `node_modules`, `.next`, ni ningún `.env`
—por eso las variables tienen que estar configuradas en Vercel—. Sí se sube
`.env.example`, que es la plantilla y no tiene valores.

El build ocurre **en los servidores de Vercel**, no en tu máquina: se sube el
código fuente y allí se ejecuta `npm install` y el `buildCommand`. Puedes
comprobar qué se subiría sin subir nada:

```bash
npx vercel deploy --dry
```

---

## 4. Conectar la carpeta con Vercel

Todo desde `Sesion_14/`. No hace falta instalar nada global: `npx` descarga el
CLI la primera vez.

```bash
# 1. Iniciar sesión (abre el navegador)
npx vercel login

# 2. Vincular esta carpeta con un proyecto de Vercel
npx vercel link
```

`vercel link` empieza mostrando lo que ya dedujo solo —la carpeta desde la que
lo lanzaste y el team de tu cuenta— y pregunta por el proyecto:

```
  Directory     C:\Code\Personal\Dmc\FS_React_Next\Sesion_14
  Team          test-dmc

? Which project?
 Search all projects
 > Create a new project
```

**Comprueba las dos primeras líneas antes de seguir**, porque son las que
deciden qué se despliega y dónde:

- `Directory` tiene que terminar en `Sesion_14`. Si dice otra cosa, cancela
  (`Ctrl+C`), muévete a esa carpeta y vuelve a lanzarlo. Esa carpeta es la raíz
  del proyecto para Vercel.
- `Team` es el *slug* de tu cuenta (`test-dmc`), que no siempre coincide con el
  nombre que se ve en el panel (`TestDmc`). Apúntalo: hace falta para los
  comandos no interactivos.

Baja con la flecha hasta **`Create a new project`** y pulsa Enter (la opción
marcada por defecto es *Search all projects*, que sirve para vincularse a un
proyecto que ya existe — no es el caso la primera vez).

Después vienen dos preguntas más:

```
? Which project?  Create a new project
? Name?           reservas
? Connect this Git repository to automatically deploy changes on every push? (y/N)
```

**`Name?` → `reservas`.** (Si te equivocaste en la pregunta anterior, la flecha
↑ te devuelve a la lista de proyectos sin tener que cancelar.)

**`Connect this Git repository…?` → `N`.** Esta es la pregunta importante y la
respuesta no es obvia, así que conviene entenderla.

El CLI ha detectado que la carpeta está dentro de un repositorio git con remoto
(`levs1205/DMC_FS_React_Next`) y ofrece conectarlo para desplegar solo en cada
push. Responder `y` aquí te mete de vuelta, por la puerta de atrás, en el flujo
por GitHub del que hablaba la [sección 3](#3-cli-o-github-cuál-conviene-aquí):
Vercel empezaría a construir la aplicación **en cada push a cualquier carpeta
del monorepo** —un cambio en `Sesion_03` dispararía un despliegue de esta app— y
además intentaría construir desde la raíz del repo, donde no hay `package.json`.

Respondiendo `N` mandas tú: se despliega cuando ejecutas `npm run deploy`. La
`N` está en mayúscula porque es el valor por defecto, así que con pulsar Enter
alcanza.

> No es irreversible. Si algún día quieres el despliegue automático, se conecta
> después con `npx vercel git connect` (y se suelta con `npx vercel git
> disconnect`), configurando antes el *Root Directory* como explica el
> [apéndice](#16-apéndice-desplegar-desde-github).

Queda una última pregunta, y antes de hacerla el CLI informa de lo que encontró:

```
  Local settings detected in vercel.json:
  Build Command: prisma migrate deploy && next build

  Detected Next.js (Build Command: next build, Output Directory: Next.js default)
? Customize settings? (y/N)
```

**`Customize settings?` → `N`.**

Esas tres líneas son un punto de control que vale la pena leer:

- **`Local settings detected in vercel.json`** confirma que Vercel está leyendo
  el `vercel.json` del proyecto. Es la comprobación de que
  `prisma migrate deploy` va a correr en cada despliegue. Si esta línea **no**
  aparece, el archivo no se está detectando y las migraciones no se aplicarían:
  cancela y revisa que `vercel.json` esté en `Sesion_14/`.
- **`Detected Next.js`** es el preset del framework, con sus valores por
  defecto. Que ahí ponga `Build Command: next build` no contradice lo anterior:
  es lo que se usaría *si no hubiera* `vercel.json`. El del archivo manda.

Por eso `N`: la configuración ya está en el repo, versionada y revisable en un
diff, que es donde debe estar. Responder `y` te dejaría escribir esos valores a
mano en el proyecto de Vercel, y a partir de ahí habría dos fuentes de verdad —
la del panel, invisible en el código, ganando sobre el archivo.

Al terminar verás:

```
✅  Linked to test-dmc/reservas (created .vercel)
```

Eso crea `.vercel/project.json` con los identificadores del proyecto. Esa
carpeta ya está en `.gitignore` y no debe versionarse.

> **Ojo con `--yes`.** `npx vercel link --yes` salta todas las preguntas, pero
> entonces el proyecto se llama como la carpeta: `sesion-14`. Para este
> proyecto conviene el modo interactivo y poner `reservas` a mano. El modo no
> interactivo tiene sentido después, para volver a vincular algo que ya existe:
>
> ```bash
> npx vercel link --yes --project reservas --team test-dmc
> ```

Comprueba que quedó bien:

```bash
npx vercel project ls     # debería aparecer "reservas"
```

---

## 5. Crear la base de datos en Neon

Neon es Postgres administrado. Se crea desde el panel de Vercel, así que las
credenciales quedan conectadas solas al proyecto que acabas de vincular.

```bash
npx vercel open     # abre el proyecto en el navegador
```

1. Pestaña **Storage** → **Create Database** → elige **Neon** (aparece como
   *Serverless Postgres*).
2. Ponle un nombre (`reservas-db`) y elige la **región**.

   **Esto importa de verdad.** Cada consulta a la base es un viaje de ida y
   vuelta por la red. Si las funciones están en Virginia y la base en Fráncfort,
   cada consulta arrastra ~100 ms de latencia, y una página que haga cinco
   consultas pierde medio segundo en puro viaje. Elige la región de la base
   **igual o lo más cerca posible** de la región de las funciones, que en
   `vercel.json` está fijada en `iad1` (Washington D.C.).

   Si prefieres otra región —por ejemplo `gru1`, São Paulo, si tu público está
   en Sudamérica— cámbiala en `vercel.json` **y** elige la misma en Neon.

3. **Desactiva el interruptor «Auth»**, que viene encendido por defecto.

   Es *Neon Auth*: un sistema de autenticación propio de Neon que crea un
   esquema `neon_auth` con perfiles de usuario sincronizados. Esta aplicación ya
   tiene el suyo —JWT firmados con `jose`, tabla `user` con roles, tabla
   `refresh_token` con rotación y revocación, y las guardias `requireRole` /
   `requireApiSession`—, así que dejarlo encendido significa tener dos sistemas
   de autenticación en la misma base: uno que se usa y otro que no, con tablas
   que nadie toca.

   No rompe nada si se queda activado (vive en su propio esquema y las
   migraciones de Prisma solo gestionan `public`), pero es ruido innecesario.

4. Elige el plan **Free** y crea la base.
5. **Connect Project**. Esta pantalla tiene cuatro bloques y tres de ellos se
   dejan como vienen:

   | Bloque | Qué poner | Por qué |
   | --- | --- | --- |
   | Project | `reservas` | El que acabas de vincular |
   | Environments | Los tres marcados | Production, Preview y Development |
   | **Create database branch** | **Marca solo «Preview»** | Ver abajo |
   | Custom Prefix | **Vacío** | Un prefijo renombraría las variables y el código busca `DATABASE_URL` |
   | Sensitive | **Apagado** | Si se activa, los valores quedan ocultos y no podrás leer la URL sin pooler para copiarla a `DIRECT_URL` |

   **Por qué marcar «Preview».** Sin eso, los tres entornos comparten **la misma
   base de datos**, y eso rompe la primera regla de la
   [sección 2](#2-los-tres-entornos): un preview existe para probar cosas, y
   alguien va a cancelar una reserva "a ver qué pasa". Con la casilla marcada,
   Neon crea una **rama por cada despliegue de preview** —una copia instantánea
   y aislada, que se borra sola cuando el despliegue desaparece— y el
   experimento no toca los datos reales.

   **Por qué NO marcar «Production».** Producción debe usar la rama por defecto,
   que es la estable y la que se respalda.

   > Las ramas de preview se crean a partir de la rama padre, así que un preview
   > arranca con una copia de los datos de producción. Aquí eso es cómodo y no
   > tiene coste: los datos son del seed. En un sistema con datos personales
   > reales habría que anonimizarlos antes.

Al conectarla, Neon inyecta varias variables solo. Compruébalo:

```bash
npx vercel env ls
```

Hay **dos conexiones distintas** y da igual bajo qué nombre lleguen, porque la
aplicación acepta los dos esquemas que se usan en la práctica:

| Para qué | Nombres aceptados, por orden |
| --- | --- |
| La que usa la **aplicación** (con pooler) | `DATABASE_URL` → `POSTGRES_URL` |
| La que usan las **migraciones** (directa) | `DIRECT_URL` → `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` |

**No busques `DIRECT_URL` en el panel de Neon: no está, ni tiene que estar.** Es
un nombre *nuestro* —la convención de Prisma para "la conexión de las
migraciones"—, no algo que cree el proveedor. Neon te da las dos conexiones con
sus propios nombres, y el código sabe reconocerlas.

En la pantalla de Neon se ven así, y el comentario lo dice todo:

```
# Recommended for most uses
DATABASE_URL=...                 ← con pooler   → la aplicación

# For uses requiring a connection without pgbouncer
DATABASE_URL_UNPOOLED=...        ← sin pooler   → las migraciones
```

Es decir: **normalmente no tienes que crear `DIRECT_URL` a mano.** Defínela solo
si `vercel env ls` no muestra ninguna URL sin pooler, o si quieres forzar una
concreta.

> `POSTGRES_PRISMA_URL` se ignora a propósito: viene con `?pgbouncer=true`
> pegado, un parámetro que entiende el motor antiguo de Prisma pero no el driver
> `pg` que usa este proyecto.

**Comprueba una cosa antes de seguir**: que la URL de las migraciones **no**
lleve `-pooler` en el host. Si las dos lo llevan, la integración no expuso la
conexión directa y hay que sacarla del panel de Neon (*Connection Details* →
desmarcar *Pooled connection*) y ponerla a mano en `DIRECT_URL`.

### Por qué hay dos conexiones y no una

Una función serverless nace, atiende un request y muere. Si cada una abriera su
propia conexión a Postgres, con algo de tráfico habría cientos de conexiones
simultáneas contra un servidor que admite ~100, y la aplicación empezaría a
devolver *"too many clients already"*. El **pooler** (PgBouncer) se pone delante
y multiplexa muchas conexiones cortas sobre unas pocas reales. Por eso la
aplicación usa siempre la URL con pooler.

Pero `prisma migrate` hace lo contrario de lo que le gusta a un pooler: abre una
sesión larga, ejecuta DDL y toma locks a nivel de sesión. PgBouncer en modo
transacción no los sostiene y la migración se cae a mitad, que es el peor
momento posible. De ahí la conexión **directa**, y de ahí `DIRECT_URL`.

---

## 6. Configurar las variables de entorno

### 6.1 Genera los secretos

Uno distinto por entorno. En tu terminal:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Ejecútalo **cuatro veces**: access y refresh, para preview y para producción.
Los cuatro distintos.

```bash
# Y uno más, para proteger el endpoint de métricas:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### 6.2 Añadirlas desde la terminal

`vercel env add <NOMBRE> <entorno>` pide el valor de forma interactiva (y no lo
muestra en pantalla, así que no queda en el historial):

```bash
npx vercel env add JWT_ACCESS_SECRET production
npx vercel env add JWT_REFRESH_SECRET production
npx vercel env add JWT_ACCESS_SECRET preview
npx vercel env add JWT_REFRESH_SECRET preview
```

Antes de pedir el valor pregunta el tipo:

```
? Environment Variable type?
> Secret (hidden in the dashboard and unavailable to pulls)
  Config (can be revealed after saving)
```

| | Secret | Config |
| --- | --- | --- |
| Visible en el dashboard | No | Sí |
| La baja `vercel env pull` | No | Sí |
| Disponible en build y runtime | **Sí** | Sí |

La última fila es la que quita el miedo: marcar algo como Secret **no cambia
nada para la aplicación**. El valor llega igual al build y al servidor; lo único
que se pierde es poder leerlo desde fuera.

**La regla: Secret para lo que nunca necesitas volver a leer, Config para lo que
sí.**

- **Secret** → `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MP_ACCESS_TOKEN`,
  `MP_WEBHOOK_SECRET`, `GEMINI_API_KEY`, `METRICS_TOKEN`.
- **Config** → `NEXT_PUBLIC_SITE_URL`, `GEMINI_MODEL`, `LOG_LEVEL`,
  `DB_POOL_SIZE`, `OTEL_SERVICE_NAME`.

Perder un secreto no es grave: se genera otro y se vuelve a desplegar. En el
caso de los `JWT_*`, el efecto es que las sesiones abiertas dejan de validar y
la gente entra de nuevo.

> **Excepción a tener en cuenta: `METRICS_TOKEN`.** Es un credencial, así que va
> como Secret, pero a diferencia de los demás **sí vas a necesitar leerlo** —es
> el que pones en la cabecera `Authorization` para consultar `/api/metrics`—. Y
> un Secret no se puede recuperar del dashboard. Guárdate una copia en tu gestor
> de contraseñas al crearlo.
>
> La regla completa, entonces: **el dashboard de Vercel no es tu archivo de
> secretos**. Es el sitio donde la aplicación los lee, no donde tú los guardas.

### 6.3 El token de métricas

```bash
npx vercel env add METRICS_TOKEN production
npx vercel env add METRICS_TOKEN preview
```

**En local no lo definas.** Sin `METRICS_TOKEN`, el endpoint queda abierto en
desarrollo —cómodo para probar— y devuelve **404** en producción. La asimetría
es deliberada: un endpoint de métricas público expone las rutas internas, el
modelo de datos y el volumen de negocio, así que en producción se esconde en vez
de quedarse abierto.

Para usarlo:

```bash
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://TU-URL/api/metrics
```

También acepta el valor por pipeline, útil para automatizar:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" \
  | npx vercel env add JWT_ACCESS_SECRET production
```

Para ver, cambiar o borrar:

```bash
npx vercel env ls
npx vercel env update NEXT_PUBLIC_SITE_URL production
npx vercel env rm VARIABLE_VIEJA production
```

### 6.4 La tabla: qué va en cada entorno  *(referencia)*

| Variable | Production | Preview | Notas |
| --- | --- | --- | --- |
| `DATABASE_URL` | *(la inyecta Neon)* | *(la inyecta Neon)* | No la escribas a mano |
| `DIRECT_URL` | *(normalmente innecesaria)* | ídem | Solo si `vercel env ls` no muestra ninguna URL sin pooler |
| `DB_POOL_SIZE` | `3` | `3` | Opcional; 3 es el valor por defecto |
| `JWT_ACCESS_SECRET` | secreto #1 | secreto #3 | Mín. 32 caracteres |
| `JWT_REFRESH_SECRET` | secreto #2 | secreto #4 | Distinto del anterior |
| `NEXT_PUBLIC_SITE_URL` | `https://tu-dominio.com` | **dejar vacía** | Sin barra final |
| `MP_ACCESS_TOKEN` | credencial **real** | credencial de **prueba** | |
| `MP_WEBHOOK_SECRET` | clave real | clave de prueba | |
| `MP_PUBLIC_BASE_URL` | *(opcional)* | **dejar vacía** | Solo para el túnel en local |
| `GEMINI_API_KEY` | tu clave | tu clave | |
| `GEMINI_MODEL` | `gemini-3-flash-lite-preview` | ídem | Opcional |
| `METRICS_TOKEN` | el token generado | el mismo o vacío | Sin él, `/api/metrics` da 404 en prod |
| `OTEL_SERVICE_NAME` | `reservas` | `reservas` | Opcional |
| `LOG_LEVEL` | `info` | `debug` | Opcional |

> **Sobre `NEXT_PUBLIC_`**: ese prefijo hace que el valor se **incruste en el
> JavaScript que baja al navegador**, en tiempo de build. Dos consecuencias: (a)
> nunca pongas un secreto con ese prefijo, es público; (b) cambiar su valor
> exige **volver a desplegar**, no basta con guardar la variable.

### 6.5 Qué inyecta Vercel solo, y qué no  *(referencia)*

Hay dos familias de variables y conviene no confundirlas.

**Las que pone Vercel** (*System Environment Variables*, sin configurar nada):

| Variable | Qué contiene |
| --- | --- |
| `VERCEL_ENV` | `production`, `preview` o `development` |
| `VERCEL_URL` | La URL de **este** despliegue, sin protocolo. Cambia en cada uno |
| `VERCEL_PROJECT_PRODUCTION_URL` | El dominio de producción del proyecto. Estable |
| `VERCEL_GIT_COMMIT_SHA` | El commit desplegado |

`VERCEL_ENV` es lo que usa `lib/config/env.ts` para decidir el `appEnv`. No hay
que configurarlo, ni se puede: lo rellena la plataforma.

**Las que pones tú**: todas las demás, incluida `NEXT_PUBLIC_SITE_URL`. Vercel
no sabe nada de ella, es una variable de esta aplicación.

### 6.6 Por qué la URL de Preview se deja vacía  *(referencia)*

Porque **cada despliegue de preview tiene una URL distinta**
(`reservas-a1b2c3-test-dmc.vercel.app`). Fijar `NEXT_PUBLIC_SITE_URL` en el
entorno Preview funciona exactamente un despliegue: en el siguiente, el
canonical, el sitemap y las `back_urls` de Mercado Pago apuntarían al despliegue
anterior.

Por eso `lib/seo/site.config.ts` la resuelve en cascada:

1. `NEXT_PUBLIC_SITE_URL` si existe — tu dominio en producción.
2. `VERCEL_PROJECT_PRODUCTION_URL` en producción — estable entre despliegues,
   que es lo que necesita un canonical (`VERCEL_URL` no vale aquí: cambiaría en
   cada despliegue).
3. `VERCEL_URL` en preview — la de ese despliegue concreto.
4. `http://localhost:3000` en local.

Consecuencia práctica: en Preview **no definas ninguna de las dos URLs** y cada
despliegue se autoconfigura. En Production, define `NEXT_PUBLIC_SITE_URL` cuando
tengas dominio propio; hasta entonces funciona con el `*.vercel.app` que asigna
Vercel.

`MP_PUBLIC_BASE_URL` sigue la misma lógica: si está vacía,
`getPublicBaseUrl()` cae en `siteConfig.url`. Solo hace falta ponerla en
desarrollo, para apuntar al túnel https.

### 6.7 Traerte las variables a local  *(opcional)*

```bash
npm run env:pull      # equivale a: vercel env pull .env.local
```

Descarga las variables del entorno **Development** a `.env.local`.

> **Dos avisos, y el segundo es serio.**
>
> 1. **Sobrescribe** el archivo. Si tienes ahí tu configuración local de clase,
>    haz una copia antes.
> 2. Entre lo que baja está la `DATABASE_URL` de Neon, así que a partir de ese
>    momento **tu `npm run dev` local escribe en la base de la nube**, no en tu
>    Postgres. Para un proyecto educativo casi nunca es lo que quieres: el
>    desarrollo local va contra el Postgres de tu máquina, que es gratis,
>    instantáneo y donde puedes romper lo que sea.
>
> Si solo quieres mirar qué variables hay, `npx vercel env ls` las lista sin
> tocar ningún archivo.

---

## 7. Las migraciones

El `buildCommand` de `vercel.json` es:

```
prisma migrate deploy && next build
```

Es decir: **cada despliegue aplica las migraciones pendientes antes de
construir**. Si una migración falla, el build falla y el despliegue nuevo nunca
llega a publicarse: los usuarios siguen viendo la versión anterior, que
funciona. Ese es justamente el comportamiento que se quiere.

Tres precisiones que ahorran disgustos:

- **`migrate deploy` no es `migrate dev`.** `deploy` solo aplica los archivos de
  migración que ya están en la carpeta. Nunca genera migraciones nuevas, nunca
  pregunta y nunca borra datos. `migrate dev` sí puede resetear la base, y por
  eso jamás debe correr en un servidor.
- **Las migraciones se generan en tu máquina** con `npm run db:migrate`, junto
  al cambio del `schema.prisma`, y viajan en la carpeta `prisma/migrations`. Esa
  carpeta es parte del código y se sube en cada despliegue.
- **Las migraciones destructivas necesitan dos pasos.** Borrar una columna que
  el código viejo todavía usa rompe la aplicación durante los segundos que
  conviven las dos versiones. El patrón seguro es: (1) desplegar el código que
  ya no la usa; (2) en un despliegue posterior, borrar la columna.

### Antes de cada despliegue que toque la base

```bash
npm run db:verify
```

Es el ensayo general de la [sección 1](#1-antes-de-empezar): aplica las
migraciones sobre una base vacía y comprueba que reproducen `schema.prisma`.
Cuesta diez segundos y es lo que separa "descubrir que falta una migración en tu
máquina" de "descubrirlo con el despliegue a medias".

### Si tu base local diverge del historial

`npx prisma migrate status` puede decirte algo así:

```
Your local migration history and the migrations table from your database are different:
The last common migration is: 0_init
The migration have not yet been applied: 20260824225037_add_room_and_booking
The migration from the database are not found locally: 20260825011912_add_room_and_booking
```

Significa que tu base tiene registrada una migración con un nombre que ya no
existe en la carpeta (se regeneró o se renombró en algún momento).

**Esto NO afecta al despliegue.** Producción parte de una base vacía y aplica
los cuatro archivos que hay en el repo; lo que tenga registrado tu base local le
es indiferente. Lo confirma `npm run db:verify`, que es justamente la
comprobación que no depende de tu base.

Lo que sí bloquea es `prisma migrate dev` en local. Tienes dos salidas:

- **Convivir con ello.** Si tu base local funciona y no vas a crear migraciones
  nuevas, no hace nada.
- **Empezar de cero en local**, que es lo limpio si los datos son de prueba:

  ```bash
  npx prisma migrate reset     # BORRA la base local y reaplica todo
  npx prisma db execute --file prisma/seed.sql
  ```

  Después de eso tu base local será, por fin, exactamente lo que producen las
  migraciones — la misma base que tendrá producción.

> **Hace falta hacerlo ahora, una vez.** La migración
> `20260914230000_hash_passwords_and_unique_login` convierte las contraseñas a
> hash, y hasta que se aplique en tu base local **el login no funcionará ahí**:
> las filas siguen teniendo texto plano y la aplicación lo rechaza. En
> producción no hay problema, porque la base nace vacía y recibe las migraciones
> en orden.

---

## 8. Desplegar

Desde `Sesion_14/`, un solo comando:

```bash
npm run deploy          # PREVIEW: URL desechable, variables de Preview
npm run deploy:prod     # PRODUCCIÓN: el dominio real, variables de Production
```

**Despliega siempre primero a preview.** Es gratis, tarda lo mismo y es la
diferencia entre descubrir un error de configuración en una URL que no usa nadie
o descubrirlo en producción.

Salida esperada:

```
  destino  preview
  rama     main
  commit   8f3926e

🔍  Inspect: https://vercel.com/tu-cuenta/reservas/7xK2...
✅  Preview: https://reservas-7xk2m9-tu-cuenta.vercel.app [1m 12s]
```

### Qué hace el script de más

`npm run deploy` no llama a `vercel` pelado, pasa por `scripts/deploy.mjs`, que
resuelve tres cosas:

1. **Etiqueta la versión.** Inyecta `RELEASE_SHA` con el hash del commit actual.
   Cuando Vercel despliega desde GitHub rellena solo `VERCEL_GIT_COMMIT_SHA`,
   que es lo que la aplicación usa como `release` en cada línea de log; por CLI
   esa variable puede no llegar al build, y entonces **todos los logs de
   producción dirían `release: "local"`**, que es justo lo que hace imposible
   responder "¿qué versión empezó a fallar?".
2. **Avisa si el árbol está sucio.** Desplegar con cambios sin commitear hace
   que el `release` del log apunte a un código que no es el que está corriendo.
   En producción pide confirmación.
3. **Funciona igual en PowerShell y en bash.** `RELEASE_SHA=$(git rev-parse …)`
   no funciona en Windows, y los scripts de npm allí corren en `cmd.exe`.

Cualquier opción extra se reenvía a `vercel`:

```bash
npm run deploy:prod -- --logs      # ver los logs del build en vivo
npm run deploy:prod -- --force     # forzar rebuild aunque nada haya cambiado
```

### Build local (opcional)

Si quieres que el build ocurra en tu máquina y subir solo el resultado —útil con
conexión lenta o para depurar el build—:

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

---

## 9. Verificar el despliegue

Con la URL que devolvió el comando:

```bash
# 1. ¿Está viva y llega a la base?
curl -s https://TU-URL/api/health | jq
```

```json
{
  "status": "ok",
  "env": "production",
  "release": "8f3926e",
  "uptimeSeconds": 3,
  "checks": { "database": { "ok": true, "latencyMs": 12 } }
}
```

Míralo con atención, porque dice cuatro cosas:

- `status: "ok"` y `database.ok: true` → hay conexión a Postgres.
- `env` → confirma si estás mirando un preview o producción.
- `release` → el commit desplegado. **Si dice `"local"`**, el `RELEASE_SHA` no
  llegó al build: revisa que estés usando `npm run deploy` y no `vercel` a secas.
- `database.latencyMs` → si esto da más de ~50 ms, la base y las funciones
  probablemente están en regiones distintas. Vuelve al paso 5.

```bash
# 2. Métricas
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://TU-URL/api/metrics | head -40

# 3. Cabeceras de seguridad
curl -sI https://TU-URL | grep -iE "strict-transport|x-content-type|x-frame|referrer|permissions"
```

Y prueba a mano el circuito completo: login, crear una reserva, pagarla con una
tarjeta de prueba de Mercado Pago.

> Las URLs de preview están protegidas por autenticación de Vercel (*Deployment
> Protection*). Si `curl` te devuelve HTML de login en vez de JSON, es eso: o
> desactivas la protección para ese despliegue, o usas `npx vercel curl <url>`,
> que añade el bypass automáticamente.

---

## 10. Cargar los datos iniciales

La base recién creada tiene el esquema pero no tiene filas. `seed.sql` crea las
dos cuentas de clase (`admin@dmc.pe` y `estudiante@dmc.pe`), seis habitaciones y
ocho reservas.

Es repetible: vacía `payment`, `booking` y `room` antes de insertar, pero a los
usuarios solo los crea **si no existen ya**, así ejecutarlo dos veces no le borra
la cuenta a nadie ni le cambia la contraseña.

**Opción A — desde el editor SQL de Neon** (lo más simple): abre el proyecto en
Neon → **SQL Editor** → pega el contenido de `prisma/seed.sql` → ejecuta.

**Opción B — desde tu máquina**, apuntando a la base remota. Usa la conexión
**directa**:

```powershell
# Windows PowerShell
$env:DATABASE_URL="postgresql://...la URL DIRECTA de Neon..."
npx prisma db execute --file prisma/seed.sql
```

```bash
# macOS / Linux
DATABASE_URL="postgresql://..." npx prisma db execute --file prisma/seed.sql
```

> **Ojo con la sintaxis.** En Prisma 7 `db execute` ya **no** acepta `--schema`:
> la URL sale de `prisma.config.ts`, que a su vez da prioridad a `DIRECT_URL` y
> `DATABASE_URL` del entorno. Si copias un comando con `--schema` de un tutorial
> viejo, fallará con `unknown or unexpected option`.

### Cambiar las contraseñas

Las del seed (`admin123` y `1234`) están escritas en la documentación: cualquiera
que lea el repositorio las conoce. Que estén guardadas con hash protege la base
si se filtra, pero no sirve de nada si la contraseña en sí es pública. Antes de
abrir el sitio a alguien que no seas tú, cámbialas.

**No se puede hacer con un `UPDATE` a secas.** La aplicación solo acepta valores
con formato de hash, así que `SET password = 'miclave'` dejaría esa cuenta sin
poder entrar. Hay que generar el hash primero:

```bash
npm run db:hash -- "la nueva contraseña"
```

Imprime el hash y el `UPDATE` listo para pegar en el SQL Editor de Neon:

```
scrypt$16384$8$1$kf/aTC6AxrU3tLx2B/x9Nw==$NHhy0XTbXV7TERe5naO+...

SQL para aplicarlo:

UPDATE "user" SET "password" = 'scrypt$16384$8$1$...' WHERE "login" = 'correo@dominio';
```

> **Cómo se guardan.** Con scrypt (`modules/auth/auth.password.ts`), sal
> aleatoria por fila y comparación en tiempo constante. scrypt es
> deliberadamente lento y consume ~16 MB por intento, que es lo que arruina el
> ataque por fuerza bruta con GPU. Los parámetros viajan dentro del propio
> valor, así que se pueden subir en el futuro sin invalidar los hashes ya
> guardados. Detalle completo en los comentarios de ese archivo.
>
> Una fila cuya contraseña siga en texto plano **no puede iniciar sesión**:
> `verifyPassword` solo acepta el formato con hash. Falla cerrado a propósito.

Para inspeccionar la base en producción:

```powershell
$env:DATABASE_URL="postgresql://..."   # la directa
npm run db:studio
```

---

## 11. Dominio propio

Opcional, pero es lo que convierte `reservas.vercel.app` en algo presentable.

```bash
npx vercel domains add tu-dominio.com
```

1. El comando te da los registros DNS (un `A` o un `CNAME`); ponlos en tu
   registrador. La propagación tarda de minutos a un par de horas.
2. El certificado HTTPS se emite y se renueva solo. No hay nada que hacer.
3. **Actualiza `NEXT_PUBLIC_SITE_URL` y `MP_PUBLIC_BASE_URL`** al dominio nuevo
   y **vuelve a desplegar** (acuérdate: `NEXT_PUBLIC_` se incrusta en build):

   ```bash
   npx vercel env update NEXT_PUBLIC_SITE_URL production
   npx vercel env update MP_PUBLIC_BASE_URL production
   npm run deploy:prod
   ```

4. Actualiza también la URL del webhook en el panel de Mercado Pago.

```bash
npx vercel domains ls     # comprobar
npx vercel certs ls       # estado del certificado
```

---

## 12. Mercado Pago en producción

1. Panel de Mercado Pago → **Tus integraciones** → tu aplicación.
2. Copia las credenciales de **producción** (`APP_USR-…`):

   ```bash
   npx vercel env add MP_ACCESS_TOKEN production
   ```

3. **Webhooks › Configurar notificaciones**: apunta a

   ```
   https://tu-dominio.com/api/payment/webhook
   ```

4. Copia la **clave secreta** que genera el panel:

   ```bash
   npx vercel env add MP_WEBHOOK_SECRET production
   ```

5. Vuelve a desplegar: `npm run deploy:prod`.

Comprueba que el webhook llega mirando los logs (paso 13): cada notificación
deja una línea. Una rechazada aparece como
`notificación de webhook rechazada` y casi siempre significa que
`MP_WEBHOOK_SECRET` no es la del modo correcto (prueba vs. producción).

> **En un preview el webhook no llega**: Deployment Protection le responde a
> Mercado Pago con la pantalla de login de Vercel. Para probar pagos de punta a
> punta, o desactivas la protección para ese despliegue, o pruebas en local con
> un túnel (`ngrok http 3000`).

---

## 13. Operar: panel web y terminal

Casi todo se puede hacer de las dos formas. El panel es mejor para explorar —los
filtros y las trazas se leen mucho mejor— y la terminal para lo repetitivo.

### 13.0 Dónde está cada cosa en el panel

Son tres sitios distintos y muestran cosas distintas, así que conviene no
confundirlos:

| Quiero ver… | Dónde | Qué encuentro |
| --- | --- | --- |
| Lo que escribe la aplicación | Proyecto → **Logs** | Cada línea JSON del logger, filtrable por campo |
| Por qué falló un despliegue | **Deployments** → uno → **Building** | La salida del build: `npm install`, `prisma migrate deploy`, `next build` |
| Dónde se va el tiempo | Proyecto → **Observability** | Peticiones, invocaciones, tasa de error y las **trazas** |
| Las métricas de la app | *(no está en el panel)* | Es nuestro endpoint `/api/metrics`, se consulta con `curl` |

**Ojo con la distinción que más confunde**: los *logs de build* y los *logs de
ejecución* son pantallas separadas. Si `prisma migrate deploy` falla, eso está en
**Building**, no en **Logs**.

#### Logs

Como el logger escribe **JSON estructurado** y no frases, el buscador de Vercel
filtra por campo. Búsquedas que vale la pena tener a mano:

| Qué quieres saber | Qué buscar |
| --- | --- |
| Solo los errores | `"level":"error"` |
| Consultas lentas a Postgres | `"msg":"consulta lenta"` |
| Todo lo de un request concreto | el `requestId` que trajo el usuario |
| El flujo de cobros | `"module":"pagos"` |
| Si el problema entró con un despliegue | `"release":"8f3926e"` |
| Intentos contra el webhook | `"msg":"notificación de webhook rechazada"` |

El último filtro de `release` es el que responde *"¿esto empezó a fallar con la
versión nueva?"* sin tener que adivinar.

#### Observability

Aquí aparecen los spans de OpenTelemetry. Entra en una traza y se ve la
jerarquía real de la petición:

```
GET /habitaciones/[slug]              ── 340 ms
├── render route (app) …              ── 335 ms
│   └── db Room.findUnique            ──   8 ms   ← extensión de Prisma
└── ...
```

En el flujo de pago verás además `mercadopago createPreference` con su duración,
que es lo que responde la pregunta de siempre: **¿va lento por nuestra culpa o
por la del proveedor?**

#### Lo que no está activado

`Analytics` (visitas y páginas vistas) y `Speed Insights` (Web Vitals reales de
los usuarios) se activan con un botón y son opcionales. En Hobby tienen cuota
limitada.

> **Retención en el plan Hobby.** Los logs y la observabilidad se guardan poco
> tiempo. Ante un incidente conviene mirar pronto; si necesitas historial de
> verdad, hay que exportar a un servicio externo, que es para lo que está
> preparado `OTEL_EXPORTER_OTLP_ENDPOINT` (ver
> [`OBSERVABILIDAD.md`](./OBSERVABILIDAD.md)).

### 13.1 Ver despliegues

```bash
npx vercel ls                    # últimos despliegues, con su estado y edad
npx vercel inspect <url>         # detalle de uno: build, tamaño, regiones
```

### 13.2 Logs desde la terminal

```bash
npx vercel logs <url>            # logs de ejecución de ese despliegue
npx vercel logs <url> --follow   # en vivo
```

Los mismos filtros de [13.0](#130-dónde-está-cada-cosa-en-el-panel), aquí con
`grep`:

```bash
npx vercel logs <url> | grep '"level":"error"'
npx vercel logs <url> | grep '"msg":"consulta lenta"'
npx vercel logs <url> | grep 'f69b7ce2-7ccd'     # un requestId concreto
npx vercel logs <url> | grep digest              # el digest de un error de render
```

> **La terminal trunca las líneas largas.** Un error de React llega como
> `[Error: An error occurred in the Serv…` y el mensaje real queda cortado.
> Cuando necesites el stack completo, mira el panel (`npx vercel open`), que
> muestra la línea entera.

El truco operativo: **cada respuesta lleva la cabecera `x-request-id`, y cada
error devuelve ese mismo id en el cuerpo JSON**. Cuando alguien reporta un
fallo, pídele ese id; con él se reconstruye el request entero —qué consultas
hizo, cuánto tardó cada una, dónde reventó— en vez de adivinar.

### 13.3 Métricas

```bash
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://tu-dominio.com/api/metrics
```

Recuerda la limitación, que está explicada a fondo en
[`OBSERVABILIDAD.md`](./OBSERVABILIDAD.md): son los contadores de **una**
instancia, no del sistema entero.

### 13.4 Trazas

**Vercel › Observability**. Los spans de `@vercel/otel` llegan solos: verás el
request, el render de cada ruta, cada consulta a la base (`db Booking.findMany`)
y cada llamada a Mercado Pago, con su duración. Es la vista que responde "¿dónde
se fue el tiempo?".

### 13.5 Rollback

Lo más valioso y lo que menos se practica:

```bash
npx vercel rollback              # vuelve al despliegue de producción anterior
npx vercel rollback <url>        # o a uno concreto
npx vercel promote <url>         # promover cualquier despliegue a producción
```

Tarda segundos y no reconstruye nada.

> **Cuidado:** el rollback revierte el *código*, no la *base de datos*. Si el
> despliegue malo aplicó una migración destructiva, volver atrás no devuelve la
> columna borrada. Por eso el patrón de dos pasos del punto 7.

Y si no sabes qué despliegue rompió algo:

```bash
npx vercel bisect     # búsqueda binaria entre despliegues
```

### 13.6 Alertas

Pon un monitor externo gratuito (UptimeRobot, Better Stack) apuntando a
`https://tu-dominio.com/api/health` cada 5 minutos. El endpoint devuelve **503**
cuando la base no responde, así que el monitor se entera antes que tus usuarios.

---

## 14. Checklist final

Antes de considerar el despliegue terminado:

- [ ] `npm run check:all` pasa en local
- [ ] `npm run db:verify` pasa: las migraciones construyen la base desde cero
- [ ] Ningún `.env` con secretos está versionado (solo `.env.example`)
- [ ] `.vercel/` no está versionado
- [ ] `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son distintos entre sí
- [ ] Los secretos de producción son distintos de los de preview y desarrollo
- [ ] La base de producción **no** es la misma que la de preview
- [ ] La región de Neon coincide con la de `vercel.json`
- [ ] Probaste primero en preview (`npm run deploy`) y funcionó
- [ ] `/api/health` devuelve `status: "ok"` y `latencyMs` razonable (< 50 ms)
- [ ] `/api/health` muestra un `release` con el hash real, no `"local"`
- [ ] `/api/metrics` devuelve 401 sin token y 200 con él
- [ ] Las cabeceras de seguridad viajan (incluida `Strict-Transport-Security`)
- [ ] `NEXT_PUBLIC_SITE_URL` apunta al dominio real, sin barra final
- [ ] Mercado Pago en producción usa credenciales reales y el webhook llega
- [ ] El seed corrió y puedes iniciar sesión
- [ ] Las contraseñas de ejemplo se cambiaron con `npm run db:hash`
- [ ] `SELECT "password" FROM "user"` devuelve solo valores que empiezan por `scrypt$`
- [ ] Hay un monitor externo vigilando `/api/health`
- [ ] Probaste `npx vercel rollback` una vez, en frío, no durante un incidente

---

## 15. Problemas frecuentes

**`Error: No existing credentials found`.**
Falta iniciar sesión: `npx vercel login`.

**El CLI pregunta por el proyecto en cada despliegue.**
No está vinculado o borraste `.vercel/`. Ejecuta `npx vercel link` otra vez.

**Respondí `y` sin querer a "Connect this Git repository…".**
Se suelta el repositorio y vuelves al despliegue manual:

```bash
npx vercel git disconnect
```

Mientras esté conectado, cada push a cualquier carpeta del monorepo dispara un
build de esta aplicación, y esos builds además fallarán porque Vercel busca el
`package.json` en la raíz del repo.

**Me equivoqué al vincular (nombre, team o carpeta mal).**
No hay que deshacer nada en el panel: el vínculo es solo un archivo local.
Bórralo y vuelve a empezar.

```bash
rm -rf .vercel          # PowerShell: Remove-Item -Recurse -Force .vercel
npx vercel link
```

Si además se creó un proyecto que no querías, bórralo con
`npx vercel project rm <nombre>`.

**El build falla con `Falta configurar la variable de entorno "X"`.**
Funciona como está diseñado: la aplicación se niega a arrancar sin su
configuración. Añade la variable **y márcala para el entorno correcto** — es el
error más común: definirla solo en Production y que el preview siga fallando.
Comprueba con `npx vercel env ls`. Después de guardarla hay que **volver a
desplegar**: las variables se leen en el build, no en caliente.

**`Configuración de producción inválida: La base de datos apunta a localhost`.**
Falta `DATABASE_URL` en producción, o la integración de Neon no quedó conectada
al proyecto.

**`/api/health` dice `release: "local"`.**
Desplegaste con `vercel` directamente en vez de `npm run deploy`, y el
`RELEASE_SHA` no llegó al build. No rompe nada, pero pierdes la trazabilidad
entre logs y versiones.

**`too many clients already` / `remaining connection slots are reserved`.**
Estás usando la conexión **directa** donde debería ir la del **pooler**.
`DATABASE_URL` tiene que ser la que lleva `-pooler` en el host. Baja también
`DB_POOL_SIZE`.

**La migración se queda colgada o falla con un error de lock.**
`DIRECT_URL` está apuntando al pooler. Tiene que ser la conexión directa, la
que **no** lleva `-pooler`.

**`npm run db:verify` dice `Database "..._verify_shadow" does not exist`.**
No debería pasar —el script crea las dos bases desechables— pero si tu usuario
de Postgres no tiene permiso para `CREATE DATABASE`, falla aquí. Concédeselo o
usa el superusuario para esta comprobación.

**`unknown or unexpected option: --schema` al ejecutar el seed.**
Sintaxis de Prisma 6 o anterior. En Prisma 7, `db execute` toma la URL de
`prisma.config.ts`; quita el `--schema`.

**Una ruta da 500 con el digest `DYNAMIC_SERVER_USAGE`.**
Le estás pidiendo a Next dos cosas incompatibles: prerenderizar una página
estáticamente y, a la vez, leer algo que depende del request (una cookie, una
cabecera).

En esta aplicación el layout raíz llama a `getSessionUser()` para mostrar quién
está conectado, así que **toda la app es dinámica**. Cualquier página que además
declare `generateStaticParams` entra en conflicto y revienta.

El síntoma engaña porque **depende de los datos del build**: si la base tenía
filas, Next prerenderiza esas rutas y el error aparece solo al pedir una nueva;
si estaba vacía —el primer despliegue, antes del seed— falla la primera visita a
cualquiera de ellas.

Arreglo: quita el `generateStaticParams` de esa página y añade
`export const dynamic = "force-dynamic"`. No perjudica al SEO —el crawler sigue
recibiendo HTML completo desde el servidor—; lo que se pierde es poder cachear
la página.

Para encontrar el digest, el log estructurado ya lo incluye:

```bash
npx vercel logs <url> | grep digest
```

**No puedo iniciar sesión: "Usuario o contraseña incorrectos".**
Tres causas, en orden de probabilidad. Compruébalas con una consulta en el SQL
Editor de Neon:

```sql
SELECT login, role, left("password", 7) AS formato FROM "user";
```

1. **Cero filas** → falta ejecutar el seed
   ([sección 10](#10-cargar-los-datos-iniciales)).
2. **`formato` no es `scrypt$`** → esa contraseña está en texto plano o en NULL,
   y la aplicación las rechaza a propósito. Genera un hash con
   `npm run db:hash -- "<contraseña>"` y aplícalo con el `UPDATE` que imprime.
3. **Todo parece correcto** → es la contraseña, sin más. No hay forma de
   recuperarla: el hash no se puede revertir. Asigna una nueva igual que en el
   punto 2.

**Después de actualizar el proyecto no puedo entrar en LOCAL.**
Tu base local todavía tiene las contraseñas en claro y la migración que las
convierte no se ha aplicado ahí. Ver
[§ 7, "Si tu base local diverge del historial"](#si-tu-base-local-diverge-del-historial).

**El despliegue sube archivos de más (o de menos).**
Comprueba con `npx vercel deploy --dry` qué se incluiría. Se respeta
`.gitignore`; si necesitas reglas distintas solo para el despliegue, crea un
`.vercelignore`.

**`Invalid Server Actions request` en un preview.**
El origen del preview no está permitido. `next.config.ts` ya incluye
`VERCEL_URL`; comprueba que el despliegue es reciente.

**El webhook de Mercado Pago devuelve 401.**
`MP_WEBHOOK_SECRET` es de un modo (prueba/producción) y las notificaciones
vienen del otro. El panel genera una clave por modo; se pueden poner las dos
separadas por coma.

**`/api/metrics` devuelve 404 en producción.**
Falta `METRICS_TOKEN`. Es deliberado: sin token, el endpoint se esconde en
producción en lugar de quedar abierto.

**`curl` a una URL de preview devuelve HTML de login.**
Es Deployment Protection. Usa `npx vercel curl <url>`, que añade el bypass.

**La primera visita después de un rato es lenta.**
Arranque en frío: la instancia estaba apagada y tiene que iniciarse y abrir la
conexión a la base. Se nota en `process_uptime_seconds`, que vuelve a empezar
desde cero. Para un proyecto educativo es normal y no hay que hacer nada.

---

## 16. Apéndice: desplegar desde GitHub

Si prefieres que cada `git push` despliegue solo, el flujo es este. Ten en
cuenta la complicación del monorepo antes de elegirlo.

1. Sube el repositorio (este ya tiene remoto: `levs1205/DMC_FS_React_Next`).

   ```bash
   git push origin main
   ```

   Antes, comprueba que no se cuela ningún secreto:

   ```bash
   git ls-files | grep -E "^Sesion_14/\.env" || echo "OK: ningun .env versionado"
   ```

   Solo debería aparecer `.env.example`.

   > Si alguna vez **sí** commiteaste un secreto: borrarlo en el commit
   > siguiente no sirve de nada, sigue en el historial y es público. Lo único
   > que lo arregla es **rotar la clave** en el servicio que la emitió.

2. En Vercel: **Add New… › Project** → importa el repositorio.

3. **Root Directory** → `Sesion_14`. Sin esto Vercel buscaría un `package.json`
   en la raíz del repo y no lo encontraría.

4. **Ignored Build Step** (Settings › Git). Sin esto, un cambio en `Sesion_03`
   dispara un despliegue de esta aplicación. Pon:

   ```bash
   git diff --quiet HEAD^ HEAD -- .
   ```

   Ese comando devuelve 0 (y Vercel cancela el build) cuando el último commit no
   tocó nada dentro de `Sesion_14`.

5. Configura las variables (sección 6) **antes** del primer despliegue.

6. A partir de ahí: push a `main` → producción; push a cualquier otra rama →
   preview automático, uno por rama o Pull Request.

Las dos formas conviven: puedes tener el repo conectado y aun así hacer un
`npm run deploy:prod` puntual desde la terminal cuando te haga falta.
