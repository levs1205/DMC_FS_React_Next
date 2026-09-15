-- ============================================================================
-- Contraseñas con hash + login único
-- ============================================================================
-- Dos arreglos de seguridad que venían arrastrándose desde las primeras
-- sesiones, cuando la tabla "user" se creó a mano:
--
--   1. La contraseña se guardaba EN CLARO. Una copia de seguridad perdida o un
--      SELECT en una captura entregaba la contraseña de todo el mundo -y, como
--      la gente repite contraseña, también su correo y su banco-.
--   2. "login" no tenía índice único, así que nada impedía dos cuentas con el
--      mismo correo. `findByLogin` devolvía "una de las dos", y cuál dependía
--      del plan de ejecución de Postgres.
--
-- El formato del hash lo define modules/auth/auth.password.ts:
--   scrypt$<N>$<r>$<p>$<sal en base64>$<hash en base64>

-- ---------------------------------------------------------------------------
-- 1. Las dos cuentas de demostración
-- ---------------------------------------------------------------------------
-- Sus contraseñas son públicas (están en el repositorio y en la documentación),
-- así que sus hashes se pueden precalcular y escribir aquí: no hay ningún
-- secreto que proteger. Para cualquier otra cuenta esto no serviría, porque
-- Postgres no sabe calcular scrypt y la contraseña original no se puede
-- recuperar del texto plano... que es precisamente el objetivo del cambio.
--
-- La condición sobre el valor actual hace que la migración sea repetible: si ya
-- está convertida, no toca nada.
UPDATE "user"
SET "password" = 'scrypt$16384$8$1$kf/aTC6AxrU3tLx2B/x9Nw==$NHhy0XTbXV7TERe5naO+p5//Yrwh6AQ2tO92T/FRFl5a+0BGsbZQ+b5vlC8dGqrKs+0LajEHtKZ+QDMle2390Q=='
WHERE "login" = 'estudiante@dmc.pe' AND "password" = '1234';

UPDATE "user"
SET "password" = 'scrypt$16384$8$1$KAahtFYF7snudbTWcTRraw==$Ocj3srRJFJTRZZelExllMwElaQ7ekD/DQCD2gIWkqknC3QHPCLcDwFlxGt3jjbZb7I8uF1d80tnRrnbnmYl2Vw=='
WHERE "login" = 'admin@dmc.pe' AND "password" = 'admin123';

-- ---------------------------------------------------------------------------
-- 2. El resto de contraseñas en claro
-- ---------------------------------------------------------------------------
-- Cualquier fila que siga sin tener forma de hash se queda en NULL. Es lo único
-- honesto que se puede hacer: no hay forma de convertir una contraseña
-- desconocida sin conocerla, y dejarla en claro sería no haber arreglado nada.
--
-- Esas cuentas no podrán iniciar sesión hasta que se les asigne una contraseña
-- nueva (falla cerrado, que es como debe fallar la autenticación):
--
--   node scripts/hash-password.mjs "la nueva contraseña"
--   UPDATE "user" SET "password" = '<el hash>' WHERE "login" = '...';
UPDATE "user"
SET "password" = NULL
WHERE "password" IS NOT NULL
  AND "password" NOT LIKE 'scrypt$%';

-- ---------------------------------------------------------------------------
-- 3. Índice único sobre "login"
-- ---------------------------------------------------------------------------
-- Si ya hay logins repetidos, CREATE UNIQUE INDEX falla con un mensaje que no
-- dice cuáles son. Esta comprobación previa lo dice, porque decidir qué cuenta
-- se queda y cuál se borra es una decisión de negocio, no algo que una
-- migración deba resolver por su cuenta.
DO $$
DECLARE
  duplicados TEXT;
BEGIN
  SELECT string_agg(DISTINCT "login", ', ')
    INTO duplicados
    FROM "user"
   WHERE "login" IS NOT NULL
   GROUP BY "login"
  HAVING count(*) > 1;

  IF duplicados IS NOT NULL THEN
    RAISE EXCEPTION
      'Hay logins duplicados y no se puede crear el indice unico: %. Resuelvelos a mano antes de migrar.',
      duplicados;
  END IF;
END $$;

-- El nombre `user_login_key` no es arbitrario: es el que Prisma genera para un
-- campo `@unique`. Con otro nombre, `prisma migrate diff` vería una diferencia
-- entre las migraciones y el schema en cada comprobación.
--
-- Postgres considera distintos entre si a todos los NULL, asi que la columna
-- puede seguir siendo opcional: varias filas sin login no se estorban.
CREATE UNIQUE INDEX "user_login_key" ON "user"("login");
