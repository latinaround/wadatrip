-- Add agent ownership fields to itineraries
ALTER TABLE "itineraries" ADD COLUMN "owner_type" TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE "itineraries" ADD COLUMN "agent_id" TEXT;

-- Add scenario metadata snapshots
ALTER TABLE "itinerary_versions" ADD COLUMN "scenario_type" TEXT;
ALTER TABLE "itinerary_versions" ADD COLUMN "items_json" JSONB;
ALTER TABLE "itinerary_versions" ADD COLUMN "kpis" JSONB;

-- Index for agent lookups
CREATE INDEX "idx_itin_agent" ON "itineraries"("agent_id");

-- FK to providers for agent ownership
ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
