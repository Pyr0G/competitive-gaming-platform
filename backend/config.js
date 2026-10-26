const port = Number(process.env.PORT) || 3000;

export const config = {
    port,
    production: process.env.NODE_ENV === "production",
    databaseUrl: process.env.DATABASE_URL,
    appUrl: (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`).replace(/\/$/, ""),
    jwtSecret: process.env.JWT_SECRET || "zmien-mnie-lokalnie",
    brevoKey: process.env.BREVO_API_KEY,
    mailFrom: process.env.MAIL_FROM,
    mailName: process.env.MAIL_NAME || "CGP Turnieje",
};

if (!config.databaseUrl) {
    console.error("Brak DATABASE_URL. Ustaw adres bazy w zmiennych środowiskowych albo w pliku .env");
    process.exit(1);
}
