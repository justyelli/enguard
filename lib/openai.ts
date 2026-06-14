import OpenAI from "openai";

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function hasOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10;
}

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!hasOpenAI()) {
    throw new Error("OPENAI_API_KEY не задан в .env");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
