#!/usr/bin/env node

/**
 * Despliegue desde esta carpeta, sin pasar por GitHub.
 *
 * Envuelve a `vercel deploy` para resolver tres cosas que si no hay que
 * acordarse a mano en cada despliegue:
 *
 * 1. **La versión desplegada.** Cuando Vercel despliega desde GitHub, rellena
 *    `VERCEL_GIT_COMMIT_SHA` y la app la usa como `release` en cada log. En un
 *    despliegue por CLI esa variable puede no llegar al build, y entonces todos
 *    los logs de producción dirían `release: "local"`, que es justo lo que hace
 *    imposible responder "¿qué versión empezó a fallar?". Aquí se calcula el
 *    SHA y se inyecta explícitamente como `RELEASE_SHA`.
 *
 * 2. **El árbol sucio.** Desplegar con cambios sin commitear es la receta para
 *    que el SHA del log apunte a un código que no es el que está corriendo. Se
 *    avisa (y en producción se pide confirmación).
 *
 * 3. **Multiplataforma.** `RELEASE_SHA=$(git rev-parse ...)` no funciona en
 *    PowerShell, y los scripts de npm en Windows corren en cmd.exe. Un script
 *    de Node funciona igual en las dos.
 *
 * Uso:
 *   npm run deploy          → despliegue de PREVIEW (URL propia, desechable)
 *   npm run deploy:prod     → despliegue de PRODUCCIÓN
 *
 * Todo lo que se pase de más se reenvía tal cual a `vercel`:
 *   npm run deploy:prod -- --force --logs
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const isProduction = args.includes("--prod");

function gitOutput(gitArgs) {
  try {
    return execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
  } catch {
    // La carpeta puede no estar en un repo: no es motivo para no desplegar.
    return null;
  }
}

const sha = gitOutput(["rev-parse", "--short=7", "HEAD"]) ?? "nogit";
const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]) ?? "desconocida";

/**
 * Solo interesan los cambios de ESTA carpeta. El repo es un monorepo de
 * sesiones y que `Sesion_09` tenga cambios sueltos no dice nada sobre lo que se
 * está por desplegar.
 */
const dirty = gitOutput(["status", "--porcelain", "."]);

console.log("");
console.log(`  destino  ${isProduction ? "PRODUCCIÓN" : "preview"}`);
console.log(`  rama     ${branch}`);
console.log(`  commit   ${sha}${dirty ? "  (+ cambios sin commitear)" : ""}`);
console.log("");

if (dirty) {
  console.warn(
    "  Aviso: hay cambios sin commitear. Se despliega el contenido actual de la\n" +
      `  carpeta, pero los logs dirán release=${sha}, que NO es exactamente este\n` +
      "  código. Para producción conviene commitear primero.\n"
  );

  if (isProduction && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("  ¿Desplegar igual a producción? (s/N) ");
    rl.close();

    if (!/^s(i|í)?$/i.test(answer.trim())) {
      console.log("\n  Cancelado.\n");
      process.exit(1);
    }
  }
}

/**
 * `--build-env` fija la variable durante el BUILD, que es cuando se compila el
 * valor que después leerá `lib/config/env.ts`.
 *
 * Sobre el rodeo por `cmd.exe /c`: desde Node 20.12, `spawn` se niega a
 * ejecutar archivos `.cmd` o `.bat` directamente (se cerró un agujero de
 * inyección de comandos), y `npx` en Windows es precisamente un `.cmd`. Sin
 * esto el proceso falla con EINVAL y sin una sola línea de salida. Se usa
 * `cmd.exe /c` en vez de `shell: true` porque con `shell` los argumentos se
 * concatenan sin escapar —Node avisa con DEP0190— y así los sigue escapando él,
 * que importa porque aquí se reenvía lo que haya escrito el usuario.
 */
const vercelArgs = [
  "vercel",
  "deploy",
  "--build-env",
  `RELEASE_SHA=${sha}`,
  ...args,
];

const [command, commandArgs] =
  process.platform === "win32"
    ? ["cmd.exe", ["/c", "npx", ...vercelArgs]]
    : ["npx", vercelArgs];

const result = spawnSync(command, commandArgs, { stdio: "inherit" });

if (result.error) {
  console.error(`\n  No se pudo ejecutar vercel: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
