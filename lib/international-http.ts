import { ProxyAgent } from "undici";

export type InternationalProvider = "gemini" | "mistral" | "twelvelabs";

const isDev = process.env.NODE_ENV === "development";
const sharedProxyURL = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? undefined;

const providerProxyURLMap: Record<InternationalProvider, string | undefined> = {
  gemini: process.env.GEMINI_PROXY_URL ?? sharedProxyURL,
  mistral: process.env.MISTRAL_PROXY_URL ?? process.env.GEMINI_PROXY_URL ?? sharedProxyURL,
  twelvelabs:
    process.env.TWELVELABS_PROXY_URL ?? process.env.GEMINI_PROXY_URL ?? sharedProxyURL,
};

const providerProxyAgentMap = new Map<InternationalProvider, ProxyAgent | undefined>();

function getProviderProxyURL(provider: InternationalProvider) {
  if (!isDev) return undefined;
  return providerProxyURLMap[provider];
}

function getProviderProxyAgent(provider: InternationalProvider) {
  if (providerProxyAgentMap.has(provider)) {
    return providerProxyAgentMap.get(provider);
  }

  const proxyURL = getProviderProxyURL(provider);
  const agent = proxyURL ? new ProxyAgent(proxyURL) : undefined;
  providerProxyAgentMap.set(provider, agent);
  return agent;
}

export const internationalProviderFetch = (async (
  provider: InternationalProvider,
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const proxyAgent = getProviderProxyAgent(provider);
  try {
    if (proxyAgent) {
      // Use the global fetch implementation so FormData/Blob bodies stay compatible.
      // We only inject `dispatcher` (undici extension) when a dev proxy is enabled.
      return await fetch(input, {
        ...(init ?? {}),
        dispatcher: proxyAgent,
      } as RequestInit & { dispatcher: ProxyAgent });
    }
    return await fetch(input, init);
  } catch (error) {
    const status = getInternationalProviderProxyStatus(provider);
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && (error as any).cause
        ? String((error as any).cause)
        : "";
    const wrapped = new Error(
      `[international-http] provider=${provider}, proxy=${status}, message=${message}${cause ? `, cause=${cause}` : ""}`,
    );
    (wrapped as any).cause = error;
    throw wrapped;
  }
}) as (
  provider: InternationalProvider,
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function getInternationalProviderProxyStatus(provider: InternationalProvider) {
  if (!isDev) return "disabled-in-production";
  const proxyURL = getProviderProxyURL(provider);
  return proxyURL ? `enabled (${proxyURL})` : "disabled";
}
