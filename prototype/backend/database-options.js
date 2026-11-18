import pg from "pg";
import { checkServerIdentity } from "node:tls";

export const databaseOptions = (databaseUrl) => {
    let url;
    try {
        url = new URL(databaseUrl);
    } catch {
        throw new Error("Niepoprawny DATABASE_URL.");
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL musi być adresem PostgreSQL.");
    const seen = new Set();
    for (const [key] of url.searchParams) {
        const name = key.toLowerCase();
        if (name === "connectionstring") throw new Error("Zagnieżdżony adres połączenia nie jest dozwolony.");
        if (!name.startsWith("ssl") && name !== "uselibpqcompat") continue;
        if (key !== name || seen.has(name)) throw new Error("Niejednoznaczne ustawienia TLS w DATABASE_URL.");
        seen.add(name);
    }
    const mode = url.searchParams.get("sslmode");
    const flag = url.searchParams.get("ssl");
    if (mode !== null && !["disable", "require", "verify-full"].includes(mode)) throw new Error("Użyj sslmode=verify-full dla zdalnej bazy.");
    if (flag !== null && !["true", "1", "false", "0"].includes(flag)) throw new Error("Niebezpieczne ustawienie ssl w DATABASE_URL.");
    if (mode !== null && flag !== null) throw new Error("Nie łącz ssl i sslmode w DATABASE_URL.");
    if (url.searchParams.has("uselibpqcompat") && url.searchParams.get("uselibpqcompat") !== "false") throw new Error("Tryb zgodności libpq nie jest dozwolony.");
    const parameters = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: true } }).connectionParameters;
    const local = ["localhost", "127.0.0.1", "::1", "db"].includes(parameters.host.toLowerCase());
    const disabled = mode === "disable" || flag === "0" || flag === "false";
    if (disabled && !local) throw new Error("TLS można wyłączyć tylko dla lokalnej bazy lub usługi db.");
    const hasTls = [...seen].some((name) => name !== "uselibpqcompat");
    const localDefault = local && parameters.host.toLowerCase() !== "db" && !hasTls;
    const ssl = { ...parameters.ssl, rejectUnauthorized: true, checkServerIdentity };
    if (parameters.ssl?.key) Object.defineProperty(ssl, "key", { value: parameters.ssl.key, enumerable: false });
    return {
        host: parameters.host,
        port: parameters.port,
        database: parameters.database,
        user: parameters.user,
        password: parameters.password,
        options: parameters.options,
        application_name: parameters.application_name,
        client_encoding: parameters.client_encoding,
        statement_timeout: parameters.statement_timeout,
        lock_timeout: parameters.lock_timeout,
        idle_in_transaction_session_timeout: parameters.idle_in_transaction_session_timeout,
        query_timeout: parameters.query_timeout,
        connectionTimeoutMillis: Number(parameters.connect_timeout) * 1000,
        sslnegotiation: parameters.sslnegotiation,
        ssl: disabled || localDefault ? false : ssl,
    };
};
