import type { LanguageModel } from "ai";

import type { Provider } from "../config.js";

export function createModel(provider: Provider): LanguageModel {
  switch (provider) {
    case "azure":
      return createAzureModel();
    case "openai":
      return createOpenAIModel();
    case "anthropic":
      return createAnthropicModel();
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${_exhaustive}`);
    }
  }
}

function createAzureModel(): LanguageModel {
  const endpoint = requireEnv("AZURE_OPENAI_ENDPOINT");
  const resourceName = endpoint?.match(/https?:\/\/([^.]+)/)?.[1];
  const apiKey = requireEnv("AZURE_OPENAI_API_KEY");
  const deployment = requireEnv("AZURE_OPENAI_DEPLOYMENT");

  // Dynamic import to avoid loading unused provider SDKs
  const { createAzure } = require("@ai-sdk/azure");
  const azure = createAzure({ resourceName, apiKey });
  return azure(deployment);
}

function createOpenAIModel(): LanguageModel {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const { createOpenAI } = require("@ai-sdk/openai");
  const openai = createOpenAI({ apiKey });
  return openai(model);
}

function createAnthropicModel(): LanguageModel {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const { createAnthropic } = require("@ai-sdk/anthropic");
  const anthropic = createAnthropic({ apiKey });
  return anthropic(model);
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Required environment variable ${name} is not set.`);
  }
  return val;
}

export function getModelId(provider: Provider): string {
  switch (provider) {
    case "azure":
      return process.env.AZURE_OPENAI_DEPLOYMENT ?? "unknown";
    case "openai":
      return process.env.OPENAI_MODEL ?? "gpt-4o";
    case "anthropic":
      return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  }
}
