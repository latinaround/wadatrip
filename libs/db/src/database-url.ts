function normalizeMode(value?: string | null) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "remote" || mode === "production") return "remote";
  if (mode === "local" || mode === "development" || mode === "dev") return "local";
  return "";
}

function isLocalUrl(value?: string | null) {
  const url = String(value || "").trim().toLowerCase();
  return url.startsWith("postgres://postgres:postgres@localhost:5432/")
    || url.startsWith("postgresql://postgres:postgres@localhost:5432/")
    || url.includes("@localhost:5432/")
    || url.includes("@127.0.0.1:5432/");
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const mode = normalizeMode(env.PRISMA_ENV);
  const localUrl = String(env.DATABASE_URL_LOCAL || "").trim();
  const remoteUrl = String(env.DATABASE_URL_REMOTE || "").trim();
  const fallbackUrl = String(env.DATABASE_URL || "").trim();

  if (mode === "local") {
    return {
      mode: "local",
      url: localUrl || fallbackUrl,
    };
  }

  if (mode === "remote") {
    return {
      mode: "remote",
      url: remoteUrl || fallbackUrl,
    };
  }

  if (localUrl) {
    return {
      mode: "local",
      url: localUrl,
    };
  }

  if (remoteUrl) {
    return {
      mode: "remote",
      url: remoteUrl,
    };
  }

  return {
    mode: isLocalUrl(fallbackUrl) ? "local" : "remote",
    url: fallbackUrl,
  };
}
