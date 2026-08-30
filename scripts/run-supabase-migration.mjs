/**
 * Aplica um arquivo SQL no Postgres do Supabase.
 * Uso: node scripts/run-supabase-migration.mjs supabase/migrations/002_analytics_funnel.sql
 *
 * Credenciais (uma das opções):
 * - DATABASE_URL
 * - SUPABASE_DB_PASSWORD (+ SUPABASE_URL para montar o host)
 * - SUPABASE_ACCESS_TOKEN (+ supabase login) via CLI
 */
import fs from "fs";
import path from "path";
import { config } from "dotenv";
import pg from "pg";
import { execSync } from "child_process";

config();

const file = process.argv[2] || "supabase/migrations/002_analytics_funnel.sql";
const sqlPath = path.resolve(file);
if (!fs.existsSync(sqlPath)) {
  console.error("Arquivo não encontrado:", sqlPath);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, "utf8");

function projectRef() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m ? m[1] : "";
}

async function runWithPg() {
  const ref = projectRef();
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  let connectionString = process.env.DATABASE_URL || "";

  if (!connectionString && password && ref) {
    const hosts = [
      `db.${ref}.supabase.co`,
      `aws-0-sa-east-1.pooler.supabase.com`,
      `aws-0-us-east-1.pooler.supabase.com`,
    ];
    const users = [`postgres.${ref}`, "postgres"];
    const ports = [5432, 6543];
    let lastErr;
    for (const host of hosts) {
      for (const user of users) {
        for (const port of ports) {
          const url = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
          const client = new pg.Client({
            connectionString: url,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 12000,
          });
          try {
            await client.connect();
            console.log("[migration] Conectado:", host, user, port);
            await client.query(sql);
            await client.end();
            return true;
          } catch (err) {
            lastErr = err;
            try { await client.end(); } catch (_) {}
          }
        }
      }
    }
    throw lastErr || new Error("Não foi possível conectar ao Postgres");
  }

  if (!connectionString) return false;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  await client.connect();
  console.log("[migration] Conectado via DATABASE_URL");
  await client.query(sql);
  await client.end();
  return true;
}

function runWithCli() {
  const ref = projectRef();
  if (!ref) return false;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || "";
  const pwdFlag = password ? ` -p "${password.replace(/"/g, '\\"')}"` : "";
  execSync(
    `npx supabase db query -f "${sqlPath.replace(/"/g, '\\"')}" --linked --project-ref ${ref}${pwdFlag} --yes`,
    { stdio: "inherit", env, shell: true }
  );
  return true;
}

async function verify() {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  const { supabaseRequest } = require("../server/supabase.js");
  await supabaseRequest("/analytics_events?select=id,utm_campaign&limit=1", {
    method: "GET",
    useService: true,
  });
  console.log("[migration] Verificação OK: coluna utm_campaign acessível.");
}

async function main() {
  console.log("[migration] Aplicando:", sqlPath);
  let ok = false;
  try {
    ok = await runWithPg();
  } catch (err) {
    console.warn("[migration] pg:", err.message);
  }
  if (!ok) {
    try {
      ok = runWithCli();
    } catch (err) {
      console.warn("[migration] cli:", err.message);
    }
  }
  if (!ok) {
    console.error(`
Não foi possível rodar a migration automaticamente.

Adicione no .env a senha do banco (Supabase → Project Settings → Database → Database password):
  SUPABASE_DB_PASSWORD=sua_senha_aqui

Depois rode de novo:
  node scripts/run-supabase-migration.mjs ${file}
`);
    process.exit(1);
  }
  await verify();
  console.log("[migration] Concluída com sucesso.");
}

main().catch((err) => {
  console.error("[migration] Falhou:", err.message);
  process.exit(1);
});
