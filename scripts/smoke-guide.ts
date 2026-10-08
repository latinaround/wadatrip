import "dotenv/config";
import axios from "axios";
const { localTestApi, localTestDatabase } = require("./local-test-target.cjs");

type AuthResponse = {
  token?: string;
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
};

type ProviderResponse = {
  id?: string;
  email?: string;
  type?: string;
  status?: string;
  base_city?: string;
  languages?: string[];
};

type ListingResponse = {
  id?: string;
  provider_id?: string;
  operator_id?: string | null;
  status?: string;
};

function buildUniqueEmail() {
  const stamp = Date.now();
  return `guide-smoke-${stamp}@example.com`;
}

function resolveBaseUrl() {
  return localTestApi(process.env.SMOKE_GUIDE_BASE_URL?.trim() || process.env.GATEWAY_URL?.trim() || undefined);
}

async function main() {
  const base = resolveBaseUrl();
  localTestDatabase(process.env.DATABASE_URL);
  const email = process.env.SMOKE_GUIDE_EMAIL || buildUniqueEmail();
  const password = process.env.SMOKE_GUIDE_PASSWORD || "GuideTest123!";
  const name = process.env.SMOKE_GUIDE_NAME || "Guide Smoke";

  console.log("Guide smoke starting at", base);
  console.log("Guide email", email);

  const register = await axios.post<AuthResponse>(`${base}/auth/register`, {
    email,
    password,
    name,
    role: "guide",
  }, { maxRedirects: 0, proxy: false });

  const token = register.data?.token;
  if (!token) {
    throw new Error("Guide register did not return a token");
  }
  if (register.data?.user?.role !== "guide") {
    throw new Error(`Expected role=guide, got ${register.data?.user?.role || "(missing)"}`);
  }

  const api = axios.create({
    maxRedirects: 0,
    proxy: false,
    baseURL: base,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 30000,
  });

  const provider = await api.patch<ProviderResponse>("/providers/me", {
    type: "guide",
    name,
    phone: "+51999999999",
    instagram_handle: "guide.smoke",
    base_city: "Cusco",
    country_code: "PE",
    languages: ["Spanish", "English"],
    photo_url: "",
    bio_short: "Smoke test guide profile",
    license_url: "",
  });

  if (!provider.data?.id) {
    throw new Error("Guide profile did not return an id");
  }
  if (provider.data?.type !== "guide") {
    throw new Error(`Expected provider type=guide, got ${provider.data?.type || "(missing)"}`);
  }

  const me = await api.get<ProviderResponse>("/providers/me");
  if (me.data?.id !== provider.data.id) {
    throw new Error("GET /providers/me did not return the saved guide profile");
  }

  const listing = await api.post<ListingResponse>("/listings", {
    provider_id: provider.data.id,
    title: "Guide Smoke Tour",
    category: "tour",
    description: "Smoke test listing",
    city: "Cusco",
    country_code: "PE",
    duration_minutes: 180,
    price_from: 25,
    currency: "USD",
    tags: ["smoke-test"],
    status: "published",
  });

  if (!listing.data?.id) {
    throw new Error("Guide listing did not return an id");
  }
  if (listing.data?.provider_id !== provider.data.id) {
    throw new Error("Guide listing provider_id mismatch");
  }

  console.log("Guide user id", register.data?.user?.id);
  console.log("Guide provider id", provider.data.id);
  console.log("Guide provider status", provider.data.status || "(missing)");
  console.log("Guide listing id", listing.data.id);
  console.log("Guide listing status", listing.data.status || "(missing)");
  console.log("✅ Guide smoke flow completed successfully");
}

main().catch((err) => {
  const details =
    err?.response?.data && typeof err.response.data === "object"
      ? JSON.stringify(err.response.data)
      : err?.message || err;
  console.error("Guide smoke failed", details);
  process.exitCode = 1;
});
