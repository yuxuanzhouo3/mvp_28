// 统一的配额请求去重工具，避免多处组件同时轮询
const inFlight: Record<string, Promise<any> | null> = {};
const lastData: Record<string, any> = {};
const lastTs: Record<string, number> = {};
const TTL_MS = 1000; // 1 秒内重复请求直接复用

// 清除缓存函数，支持外部调用
export function clearQuotaCache(url?: string) {
  if (url) {
    delete lastData[url];
    delete lastTs[url];
  } else {
    // 清除所有缓存
    Object.keys(lastData).forEach((key) => delete lastData[key]);
    Object.keys(lastTs).forEach((key) => delete lastTs[key]);
  }
}

// 监听 quota:refresh 事件，清除缓存
if (typeof window !== "undefined") {
  window.addEventListener("quota:refresh", () => {
    clearQuotaCache();
    console.log("[quota-fetcher] Cache cleared by quota:refresh event");
  });
}

export async function fetchQuotaShared(url: string = "/api/account/quota") {
  const now = Date.now();
  if (lastTs[url] && now - lastTs[url] < TTL_MS && lastData[url]) {
    return lastData[url];
  }
  if (inFlight[url]) {
    return inFlight[url] as Promise<any>;
  }
  inFlight[url] = (async () => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`quota fetch failed ${res.status}`);
      }
      const data = await res.json();
      lastData[url] = data;
      lastTs[url] = Date.now();
      return data;
    } finally {
      inFlight[url] = null;
    }
  })();
  return inFlight[url] as Promise<any>;
}
