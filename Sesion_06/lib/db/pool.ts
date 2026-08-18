import { Pool } from "pg";
import { dbConfig } from "@/lib/config/env";

// Se reutiliza la misma instancia entre recargas de Fast Refresh en desarrollo.
declare global {
  var __pgPool: Pool | undefined;
}

export const pool =
  globalThis.__pgPool ??
  new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__pgPool = pool;
}
