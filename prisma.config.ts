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

export default defineConfig({
  schema: "./libs/db/prisma/schema.prisma",
});
