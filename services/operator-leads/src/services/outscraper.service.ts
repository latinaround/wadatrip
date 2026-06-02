import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DEFAULT_OPERATOR_LEAD_LIMIT,
  OPERATOR_LEAD_SEARCH_TERMS,
} from '../constants/operator-leads.constants';

type OutscraperGroup = {
  query: string;
  items: Record<string, any>[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenObjects(input: any): Record<string, any>[] {
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenObjects(item));
  }
  if (input && typeof input === 'object') {
    return [input as Record<string, any>];
  }
  return [];
}

function resolveOutscraperBaseUrls(): string[] {
  const candidates = [
    process.env.OUTSCRAPER_BASE_URL,
    'https://api.outscraper.com',
    'https://api.outscraper.cloud',
  ];
  const unique = new Set<string>();
  for (const raw of candidates) {
    const normalized = String(raw || '').trim().replace(/\/$/, '');
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

@Injectable()
export class OutscraperService {
  private readonly apiKey = String(process.env.OUTSCRAPER_API_KEY || '').trim();
  private readonly resultLimit = Math.max(
    1,
    Number(process.env.OUTSCRAPER_RESULTS_LIMIT || DEFAULT_OPERATOR_LEAD_LIMIT),
  );

  async searchPlaces(queries: string[]): Promise<OutscraperGroup[]> {
    if (!this.apiKey) {
      throw new BadRequestException('OUTSCRAPER_API_KEY is not configured');
    }

    const cleanQueries = queries.map((query) => String(query || '').trim()).filter(Boolean);
    if (!cleanQueries.length) {
      return [];
    }

    const payload = {
      query: cleanQueries,
      limit: this.resultLimit,
      async: false,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
    };

    let lastError: string | null = null;
    for (const baseUrl of resolveOutscraperBaseUrls()) {
      try {
        const response = await fetch(`${baseUrl}/google-maps-search`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          lastError =
            data?.errorMessage ||
            data?.message ||
            `Outscraper request failed with status ${response.status}`;
          continue;
        }

        if (data?.results_location) {
          const polled = await this.pollResults(String(data.results_location), headers);
          return this.normalizeResponse(cleanQueries, polled);
        }

        return this.normalizeResponse(cleanQueries, data);
      } catch (error: any) {
        lastError = error?.message || 'Outscraper request failed';
      }
    }

    throw new BadRequestException(lastError || 'Could not fetch leads from Outscraper');
  }

  buildQueries(city: string, country: string, customQueries?: string[]) {
    const custom = Array.isArray(customQueries)
      ? customQueries.map((item) => String(item || '').trim()).filter(Boolean)
      : [];
    const terms = custom.length ? custom : [...OPERATOR_LEAD_SEARCH_TERMS];
    return terms.map((term) => `${term} ${city} ${country}`.trim());
  }

  private async pollResults(resultsLocation: string, headers: Record<string, string>) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(resultsLocation, { headers });
      const data = await response.json().catch(() => null);
      if (response.ok && data && !data?.status) {
        return data;
      }
      if (String(data?.status || '').toLowerCase() === 'failure') {
        throw new BadRequestException('Outscraper request failed before returning results');
      }
      await sleep(2500);
    }
    throw new BadRequestException('Timed out waiting for Outscraper results');
  }

  private normalizeResponse(queries: string[], raw: any): OutscraperGroup[] {
    if (Array.isArray(raw) && raw.length === queries.length && raw.every((item) => Array.isArray(item))) {
      return raw.map((items, index) => ({
        query: queries[index],
        items: flattenObjects(items),
      }));
    }

    const objects = flattenObjects(raw?.items ?? raw?.results ?? raw?.data ?? raw);
    const grouped = new Map<string, Record<string, any>[]>();
    for (const query of queries) grouped.set(query, []);

    for (const item of objects) {
      const sourceQuery = String(
        item?.query ||
          item?.search_query ||
          item?.keyword ||
          item?.input ||
          queries[0],
      ).trim();
      const bucket = grouped.get(sourceQuery) || grouped.get(queries[0]) || [];
      bucket.push(item);
      if (!grouped.has(sourceQuery)) grouped.set(sourceQuery, bucket);
    }

    return Array.from(grouped.entries()).map(([query, items]) => ({ query, items }));
  }
}
