-- ============================================================================
-- Data de prueba para el módulo de reservas.
-- Ejecutar con:  npx prisma db execute --file prisma/seed.sql
-- ============================================================================
-- Es idempotente: se puede correr las veces que haga falta.
--
--   - "booking", "room" y "payment" se vacían y se vuelven a llenar.
--   - "user" NO se vacía: los usuarios solo se insertan si no existen ya, así
--     ejecutar esto contra una base con gente de verdad no le borra la cuenta
--     a nadie ni le cambia la contraseña.

BEGIN;

-- CASCADE arrastra "payment", que referencia a "booking". Se nombra explícito
-- para que quede claro que también se vacía.
TRUNCATE TABLE "payment", "booking", "room" RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------
-- Sin esto, una base RECIÉN CREADA se queda sin ninguna cuenta y no se puede
-- ni entrar; y los INSERT de reservas de más abajo —que buscan el usuario por
-- su login— fallarían al no encontrar a nadie.
--
-- Las contraseñas van con HASH, nunca en claro: el valor es lo que produce
-- modules/auth/auth.password.ts (scrypt con sal por fila). Los de aquí abajo
-- corresponden a '1234' y 'admin123', y se pueden escribir en el repositorio
-- porque son credenciales de demostración públicas.
--
-- Para generar el hash de otra contraseña:
--   node scripts/hash-password.mjs "la contraseña"
--
-- `ON CONFLICT DO NOTHING` sobre el índice único de "login" es lo que lo hace
-- repetible: si la cuenta ya existe, no se toca —ni el nombre, ni el rol, ni la
-- contraseña, que a estas alturas puede ser una que se cambió a mano—.
INSERT INTO "user" ("name", "login", "password", "role")
VALUES
  ('Estudiante Dmc', 'estudiante@dmc.pe',
   'scrypt$16384$8$1$kf/aTC6AxrU3tLx2B/x9Nw==$NHhy0XTbXV7TERe5naO+p5//Yrwh6AQ2tO92T/FRFl5a+0BGsbZQ+b5vlC8dGqrKs+0LajEHtKZ+QDMle2390Q==',
   'STUDENT'),
  ('Admin Demo', 'admin@dmc.pe',
   'scrypt$16384$8$1$KAahtFYF7snudbTWcTRraw==$Ocj3srRJFJTRZZelExllMwElaQ7ekD/DQCD2gIWkqknC3QHPCLcDwFlxGt3jjbZb7I8uF1d80tnRrnbnmYl2Vw==',
   'ADMIN')
ON CONFLICT ("login") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Habitaciones
-- ---------------------------------------------------------------------------
INSERT INTO "room" ("name", "type", "capacity", "price_per_night", "description")
VALUES
  ('Habitación 101',      'SINGLE', 1, 120.00, 'Individual con vista interior, cama queen y escritorio.'),
  ('Habitación 102',      'SINGLE', 1, 130.00, 'Individual con vista a la calle y balcón pequeño.'),
  ('Habitación 201',      'DOUBLE', 2, 210.00, 'Doble con dos camas y baño completo.'),
  ('Habitación 202',      'DOUBLE', 3, 240.00, 'Doble superior con sofá cama adicional.'),
  ('Suite Miraflores',    'SUITE',  4, 480.00, 'Suite con sala independiente y vista al malecón.'),
  ('Suite Presidencial',  'SUITE',  5, 750.00, 'Suite de dos ambientes, jacuzzi y desayuno incluido.');

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------
-- Se referencian habitación y usuario por su nombre/login (no por id fijo),
-- así el script sigue funcionando aunque cambien los autoincrementales.
INSERT INTO "booking" ("room_id", "user_id", "start_date", "end_date", "status", "total_price")
VALUES
  ((SELECT id FROM "room" WHERE name = 'Habitación 101'),
   (SELECT id FROM "user" WHERE login = 'estudiante@dmc.pe'),
   '2026-09-01', '2026-09-04', 'CONFIRMED',   360.00),

  ((SELECT id FROM "room" WHERE name = 'Habitación 102'),
   (SELECT id FROM "user" WHERE login = 'admin@dmc.pe'),
   '2026-09-05', '2026-09-07', 'PENDING',     260.00),

  ((SELECT id FROM "room" WHERE name = 'Habitación 201'),
   (SELECT id FROM "user" WHERE login = 'estudiante@dmc.pe'),
   '2026-09-10', '2026-09-15', 'CONFIRMED',  1050.00),

  ((SELECT id FROM "room" WHERE name = 'Habitación 202'),
   (SELECT id FROM "user" WHERE login = 'admin@dmc.pe'),
   '2026-09-12', '2026-09-14', 'RESCHEDULED', 480.00),

  ((SELECT id FROM "room" WHERE name = 'Suite Miraflores'),
   (SELECT id FROM "user" WHERE login = 'estudiante@dmc.pe'),
   '2026-10-01', '2026-10-05', 'PENDING',    1920.00),

  ((SELECT id FROM "room" WHERE name = 'Suite Presidencial'),
   (SELECT id FROM "user" WHERE login = 'admin@dmc.pe'),
   '2026-10-08', '2026-10-10', 'CANCELLED',  1500.00),

  ((SELECT id FROM "room" WHERE name = 'Habitación 101'),
   (SELECT id FROM "user" WHERE login = 'admin@dmc.pe'),
   '2026-11-20', '2026-11-23', 'PENDING',     360.00),

  ((SELECT id FROM "room" WHERE name = 'Habitación 201'),
   (SELECT id FROM "user" WHERE login = 'estudiante@dmc.pe'),
   '2026-12-24', '2026-12-26', 'CONFIRMED',   420.00);

COMMIT;

-- ============================================================================
-- ANTES DE ABRIR ESTO A NADIE MÁS QUE A TI
-- ============================================================================
-- Estas credenciales son de demostración: '1234' y 'admin123' están escritas en
-- la documentación y cualquiera que lea el repositorio las conoce. Que estén
-- con hash protege la base si se filtra, pero no sirve de nada si la contraseña
-- en sí es pública.
--
-- Para cambiarlas en un despliegue real:
--
--   node scripts/hash-password.mjs "la nueva contraseña"
--   UPDATE "user" SET "password" = '<el hash que imprime>'
--    WHERE "login" = 'admin@dmc.pe';
--
-- NO se puede hacer `UPDATE ... SET password = 'texto plano'`: la aplicación
-- solo acepta valores con formato de hash, así que esa cuenta se quedaría sin
-- poder entrar.
-- ============================================================================
