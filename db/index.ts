import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "[Database] Missing required environment variable: DATABASE_URL. Please check your .env file.",
  );
}

const sql = postgres(process.env.DATABASE_URL);

export default sql;
