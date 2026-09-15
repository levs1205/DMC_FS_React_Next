import "server-only";

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

/**
 * Hash de contraseñas con scrypt.
 *
 * ## Por qué no se guarda la contraseña tal cual
 *
 * Porque una base de datos se filtra. Pasa con copias de seguridad olvidadas,
 * con un `SELECT` en una captura de pantalla, con un volcado que alguien sube a
 * un sitio equivocado. Si ahí dentro están las contraseñas en claro, el daño no
 * se queda en esta aplicación: la mayoría de la gente repite contraseña, así
 * que se está entregando también su correo y su banco.
 *
 * ## Por qué scrypt y no SHA-256
 *
 * Un hash normal (SHA-256, MD5) está diseñado para ser **rápido**, y esa es
 * exactamente la propiedad que no se quiere aquí: una GPU prueba miles de
 * millones de candidatos por segundo contra un SHA-256. scrypt está diseñado al
 * revés: es deliberadamente lento y, sobre todo, consume mucha **memoria**, que
 * es lo que estropea el ataque con GPU —hay muchos núcleos, pero poca memoria
 * por núcleo—. Cada intento le cuesta al atacante ~16 MB y ~100 ms.
 *
 * bcrypt y argon2 sirven igual de bien; scrypt tiene la ventaja de venir dentro
 * de Node, sin una dependencia más que mantener y auditar.
 *
 * ## Por qué cada contraseña lleva su propia sal
 *
 * Sin sal, dos personas con la misma contraseña tienen el mismo hash: se ve de
 * un vistazo quién comparte clave, y una única tabla precalculada (rainbow
 * table) las rompe todas de golpe. Con una sal aleatoria por fila, el atacante
 * tiene que atacar cada contraseña por separado.
 *
 * ## Formato almacenado
 *
 *   scrypt$16384$8$1$<sal en base64>$<hash en base64>
 *
 * Los parámetros van DENTRO del valor, no en el código. Es lo que permite
 * subirlos dentro de unos años —el hardware mejora— sin invalidar los hashes ya
 * guardados: cada fila se verifica con los parámetros con los que se creó.
 */

/**
 * `scrypt` con promesas.
 *
 * Se envuelve a mano en vez de con `promisify` porque `promisify` se queda con
 * la primera sobrecarga de la función —la que NO acepta opciones— y aquí los
 * parámetros de coste son justamente lo que hay que pasar.
 *
 * Se usa la versión asíncrona y no `scryptSync` a propósito: el cálculo tarda
 * ~100 ms, y en la versión síncrona esos 100 ms bloquean el bucle de eventos
 * entero. Con diez logins simultáneos, el décimo esperaría un segundo sin que
 * el servidor pudiera atender nada más, ni siquiera servir una imagen.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const ALGORITHM = "scrypt";

/**
 * Coste. `N` es el que manda: duplicarlo duplica tiempo y memoria.
 * 16384 · 8 · 128 bytes ≈ 16 MB por intento, unos 100 ms. Es el valor por
 * defecto de Node y un punto razonable entre seguridad y latencia de login.
 */
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

// `scrypt` de Node aborta si el cálculo necesita más memoria de la permitida, y
// el límite por defecto (32 MB) queda justo. Se pide holgura explícita.
const MAX_MEMORY = 64 * 1024 * 1024;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(password.normalize("NFKC"), salt, KEY_BYTES, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
}

/** Genera el valor que se guarda en la columna `user.password`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** ¿Este valor tiene forma de hash nuestro? */
export function isHashedPassword(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(`${ALGORITHM}$`);
}

/**
 * Comprueba una contraseña contra el valor guardado.
 *
 * Devuelve `false` —nunca lanza— ante cualquier valor que no sea un hash con
 * este formato. Esa es la decisión de diseño importante: una fila que todavía
 * tenga la contraseña en claro **no puede iniciar sesión**. Falla cerrado. La
 * alternativa (aceptar el texto plano "solo por esta vez") deja abierta para
 * siempre la puerta que se venía a cerrar.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!isHashedPassword(stored)) return false;

  const [, rawCost, rawBlockSize, rawParallelization, rawSalt, rawKey] =
    (stored as string).split("$");

  const cost = Number(rawCost);
  const blockSize = Number(rawBlockSize);
  const parallelization = Number(rawParallelization);

  if (!cost || !blockSize || !parallelization || !rawSalt || !rawKey) {
    return false;
  }

  let expected: Buffer;
  let actual: Buffer;

  try {
    expected = Buffer.from(rawKey, "base64");

    actual = await scryptAsync(
      password.normalize("NFKC"),
      Buffer.from(rawSalt, "base64"),
      expected.length,
      {
        N: cost,
        r: blockSize,
        p: parallelization,
        maxmem: MAX_MEMORY,
      }
    );
  } catch {
    // Parámetros corruptos o fuera de rango: no es un hash utilizable.
    return false;
  }

  // `timingSafeEqual` en vez de `===`: comparar byte a byte y cortar en la
  // primera diferencia tarda distinto según cuánto se acertó, y ese tiempo se
  // puede medir desde fuera.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Consume el mismo tiempo que una verificación real, sin verificar nada.
 *
 * Se usa cuando el usuario no existe. Sin esto, un login inexistente responde
 * en 2 ms y uno existente en 100 ms, y esa diferencia es medible: permite
 * averiguar qué correos están registrados probando uno por uno. Devolver el
 * mismo mensaje de error no sirve de nada si el reloj delata la respuesta.
 */
export async function fakeVerifyPassword(password: string): Promise<void> {
  await derive(password, randomBytes(SALT_BYTES));
}
