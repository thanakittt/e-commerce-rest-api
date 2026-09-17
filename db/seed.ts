import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sql from "./index";

async function seed() {
  const seedFilePath = resolve(import.meta.dir, "seeds.sql");
  console.log(`[Seed] Running SQL seed file from ${seedFilePath}...`);
  
  const sqlContent = readFileSync(seedFilePath, "utf8");
  await sql.unsafe(sqlContent);
  
  console.log("[Seed] Database seeded successfully!");
  await sql.end();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("[Seed] Failed to seed database:", err);
  await sql.end();
  process.exit(1);
});
