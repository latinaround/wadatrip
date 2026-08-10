import { defineConfig } from "@prisma/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const platformEnvPath = path.join(__dirname, ".env");
const prismaEnvPath = path.join(__dirname, "libs/db/prisma/.env");

// Load shared defaults (if present inside libs/db/prisma/.env) and then override with platform root values.
loadEnv({ path: prismaEnvPath, override: false });
loadEnv({ path: platformEnvPath, override: true });

function normalizeMode(value?: string | null) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "remote" || mode === "production") return "remote";
  if (mode === "local" || mode === "development" || mode === "dev") return "local";
  return "";
}

const prismaMode = normalizeMode(process.env.PRISMA_ENV);
const localUrl = String(process.env.DATABASE_URL_LOCAL || "").trim();
const remoteUrl = String(process.env.DATABASE_URL_REMOTE || "").trim();

if (prismaMode === "local" && localUrl) {
  process.env.DATABASE_URL = localUrl;
} else if (prismaMode === "remote" && remoteUrl) {
  process.env.DATABASE_URL = remoteUrl;
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = localUrl || remoteUrl || "";
}

export default defineConfig({
  schema: "./libs/db/prisma/schema.prisma",
});
