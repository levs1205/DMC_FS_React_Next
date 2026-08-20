interface PostgresConnectionParts {
    host: string,
    port: number,
    user: string,
    password: string,
    database: string,
}


export function buildDatabaseUrl ({host, port, user, password, database}: PostgresConnectionParts): string {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}