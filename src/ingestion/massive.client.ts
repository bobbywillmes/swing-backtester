import axios, { AxiosInstance } from "axios";
import { getEnv } from "../config/env.js";
import { MassiveResponse, MassiveAgg } from "../types/ohlc.types.js";

export class MassiveClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const env = getEnv();
    this.baseUrl = env.MASSIVE_BASE_URL;
    this.apiKey = env.MASSIVE_API_KEY;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async get5MinBars(
    ticker: string,
    fromMs: number,
    toMs: number
  ): Promise<MassiveAgg[]> {
    const allResults: MassiveAgg[] = [];
    let nextUrl: string | undefined = this.buildUrl(
      ticker,
      fromMs,
      toMs
    );

    while (nextUrl) {
      const response = await this.client.get<MassiveResponse>(nextUrl);

      if (response.data.status !== "OK") {
        throw new Error(
          `Massive API error: ${response.data.status} for ${ticker}`
        );
      }

      if (response.data.results) {
        allResults.push(...response.data.results);
      }

      // next_url is already a full URL with all params
      if (response.data.next_url) {
        // Extract path from full URL
        const url = new URL(response.data.next_url);
        nextUrl = url.pathname + url.search;
      } else {
        nextUrl = undefined;
      }
    }

    return allResults;
  }

  private buildUrl(ticker: string, fromMs: number, toMs: number): string {
    return `/v2/aggs/ticker/${ticker}/range/5/minute/${fromMs}/${toMs}`;
  }
}

export function createMassiveClient(): MassiveClient {
  return new MassiveClient();
}
