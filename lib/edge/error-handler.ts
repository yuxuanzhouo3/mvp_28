// lib/edge/error-handler.ts - Edge Runtime compatible error handling
export enum ErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFIG_ERROR = "CONFIG_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class ArchitectureError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "ArchitectureError";
  }
}

/**
 * Edge-compatible fetch with timeout using AbortController
 * Note: Vercel Edge Runtime supports AbortController but timeout handling is simplified
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    // Use a timeout mechanism that works in Edge Runtime
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ArchitectureError(
        `Request timeout after ${timeoutMs}ms`,
        ErrorType.TIMEOUT_ERROR,
        "TIMEOUT",
        true
      ));
    }, timeoutMs);
    
    // Clear timeout if fetch completes (handled in try-catch)
    fetch(url, { ...options, signal: controller.signal })
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId));
  });

  try {
    const fetchPromise = fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    return response as Response;
  } catch (error) {
    if (error instanceof ArchitectureError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ArchitectureError(
        `Request timeout after ${timeoutMs}ms`,
        ErrorType.TIMEOUT_ERROR,
        "TIMEOUT",
        true
      );
    }
    throw error;
  }
}

/**
 * Edge-compatible retry mechanism (without setTimeout)
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // 如果不是可重试的错误，直接抛出
      if (error instanceof ArchitectureError && !error.retryable) {
        throw error;
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        break;
      }

      // 等待后重试 - Edge compatible delay
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);
      await delayMsEdge(delay);
    }
  }

  throw lastError!;
}

/**
 * Edge-compatible delay function
 * Note: Vercel Edge Runtime actually supports setTimeout, so we can use it
 */
function delayMsEdge(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Edge-compatible fallback handler
 */
export class FallbackHandler {
  private fallbacks: Array<() => Promise<any>> = [];

  addFallback(fallback: () => Promise<any>): void {
    this.fallbacks.push(fallback);
  }

  async executeWithFallbacks(): Promise<any> {
    let lastError: Error | null = null;

    for (const fallback of this.fallbacks) {
      try {
        return await fallback();
      } catch (error) {
        lastError = error as Error;
        console.warn("Fallback failed, trying next:", error);
        continue;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new ArchitectureError(
      "All fallbacks failed",
      ErrorType.UNKNOWN_ERROR,
      "ALL_FALLBACKS_FAILED",
      false
    );
  }
}

/**
 * Classify error type
 */
export function classifyError(error: any): ArchitectureError {
  if (error instanceof ArchitectureError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new ArchitectureError(
      error.message,
      ErrorType.NETWORK_ERROR,
      "NETWORK_ERROR",
      true
    );
  }

  if (error instanceof Error) {
    return new ArchitectureError(
      error.message,
      ErrorType.UNKNOWN_ERROR,
      "UNKNOWN_ERROR",
      false
    );
  }

  return new ArchitectureError(
    String(error),
    ErrorType.UNKNOWN_ERROR,
    "UNKNOWN_ERROR",
    false
  );
}

/**
 * Simple error recovery (Edge compatible - no persistent storage)
 */
export const errorRecovery = {
  recordError: (_service: string, _error: ArchitectureError) => {
    // In Edge Runtime, we just log - no persistent storage
    console.error(`Error recorded for ${_service}:`, _error);
  },
};

