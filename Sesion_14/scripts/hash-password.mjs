#!/usr/bin/env node

/**
 * Calcula el hash de una contraseña, con el mismo formato que usa la
 * aplicación.
 *
 * Existe porque, desde que las contraseñas se guardan con hash, ya no se puede
 * cambiar una con un `UPDATE ... SET password = 'loquesea'`: eso dejaría texto
 * plano en la columna y `verifyPassword` lo rechazaría, así que el usuario
 * quedaría sin poder entrar (y sin saber por qué).
 *
 * Uso:
 *   node scripts/hash-password.mjs "mi contraseña"
 *   npm run db:hash -- "mi contraseña"
 *
 * Imprime el hash y el UPDATE listo para pegar en el SQL Editor de Neon.
 *
 * Se duplica aquí la lógica de `modules/auth/auth.password.ts` —son treinta
 * líneas— porque ese módulo lleva `import "server-only"` y no se puede ejecutar
 * desde Node a secas. El formato es el mismo; si se cambian los parámetros
 * allí, hay que cambiarlos aquí.
 */

import { randomBytes, scryptSync } from "node:crypto";

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

const password = process.argv[2];

if (!password) {
  console.error('Uso: node scripts/hash-password.mjs "<contraseña>"');
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const key = scryptSync(password.normalize("NFKC"), salt, KEY_BYTES, {
  N: COST,
  r: BLOCK_SIZE,
  p: PARALLELIZATION,
  maxmem: MAX_MEMORY,
});

const hash = [
  "scrypt",
  COST,
  BLOCK_SIZE,
  PARALLELIZATION,
  salt.toString("base64"),
  key.toString("base64"),
].join("$");

console.log(`\n${hash}\n`);
console.log("SQL para aplicarlo:\n");
console.log(
  `UPDATE "user" SET "password" = '${hash}' WHERE "login" = 'correo@dominio';\n`
);
