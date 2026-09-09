-- ============================================================================
-- Data de prueba para el módulo de reservas.
-- Ejecutar con:  npx prisma db execute --file prisma/seed.sql
-- ============================================================================
-- Es idempotente: limpia "booking" y "room" antes de insertar, así se puede
-- correr las veces que haga falta. La tabla "user" NO se toca.

BEGIN;

TRUNCATE TABLE "booking", "room" RESTART IDENTITY CASCADE;

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
