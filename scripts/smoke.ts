import "dotenv/config";
import axios from "axios";
import { PrismaClient } from "@prisma/client";

type Scenario = {
  total_price?: number;
};

type GenerateResponse = {
  itinerary_id: string;
  scenarios: Scenario[];
};

type MineResponse = {
  itineraries: { itinerary_id: string }[];
};

type CreateIntentResponse = {
  clientSecret?: string;
  mock?: boolean;
  reason?: string;
};

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const base = process.env.GATEWAY_URL || "http://localhost:3000";
    const authEmail = process.env.SMOKE_USER_EMAIL || "demo@wadatrip.local";
    const authPassword = process.env.SMOKE_USER_PASSWORD || "wadatrip123";

    // 🔥 Usar proveedores REALES por defecto
    const providers = {
      flights: process.env.SMOKE_PROVIDER_FLIGHTS || "travelpayouts",
      hotels: process.env.SMOKE_PROVIDER_HOTELS || "travelpayouts",
      activities: process.env.SMOKE_PROVIDER_ACTIVITIES || "viator",
    };

    console.log("Smoke starting at", base);
    console.log("Using providers", providers);

    const auth = await axios.post(`${base}/auth/login`, { email: authEmail, password: authPassword });
    const token = auth.data?.token as string | undefined;
    if (!token) {
      throw new Error("Login did not return a token");
    }

    const api = axios.create({
      baseURL: base,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 60000,
    });

    const departure = new Date();
    departure.setDate(departure.getDate() + 7);
    const returnDate = new Date(departure);
    returnDate.setDate(returnDate.getDate() + 4);

    const generateBody = {
      origin: "SCL",
      destination: "JFK",
      start_date: departure.toISOString().slice(0, 10),
      end_date: returnDate.toISOString().slice(0, 10),
      adults: 1,
      budget_total: 1800,
      title: "Smoke test SCL-JFK",
    };

    const generate = await api.post<GenerateResponse>(
      "/itineraries/generate",
      generateBody,
      {
        params: {
          providerFlights: providers.flights,
          providerHotels: providers.hotels,
          providerActivities: providers.activities,
        },
      },
    );

    const itineraryId = generate.data.itinerary_id;
    if (!itineraryId) {
      throw new Error("Itinerary id missing in generate response");
    }
    console.log("Generated itinerary", itineraryId, "scenarios", generate.data.scenarios.length);

    await sleep(500);

    const mine = await api.get<MineResponse>("/itineraries/mine");
    const mineIds = mine.data.itineraries?.map((it) => it.itinerary_id) || [];
    if (!mineIds.includes(itineraryId)) {
      throw new Error("Generated itinerary not found in /itineraries/mine response");
    }
    console.log("/itineraries/mine includes new itinerary");

    const persisted = await prisma.itineraries.findUnique({
      where: { id: itineraryId },
      include: { versions: { include: { items: true } } },
    });
    if (!persisted) {
      throw new Error("Itinerary was not stored in the database");
    }
    console.log(
      "Persisted versions",
      persisted.versions.length,
      "items",
      persisted.versions.reduce((acc, version) => acc + version.items.length, 0),
    );

    const primaryScenario = generate.data.scenarios[0];
    const amountCents = Math.max(
      50,
      Math.round(((primaryScenario?.total_price as number | undefined) || 0) * 100),
    );

    const intent = await api.post<CreateIntentResponse>("/payments/create-intent", {
      amount: amountCents,
      currency: "usd",
      description: `Smoke checkout ${itineraryId}`,
    });

    if (!intent.data.clientSecret) {
      throw new Error("Stripe intent did not return clientSecret");
    }

    console.log("Payment intent clientSecret", intent.data.clientSecret?.slice(0, 12) + "...");

    console.log("✅ Smoke flow completed successfully (real providers)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Smoke failed", err);
  process.exitCode = 1;
});
