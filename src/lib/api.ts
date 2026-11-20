import type { ApiError } from "../../shared/contracts";

export class RequestError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(code);
  }
}

export type Request = <T>(path: string, options?: RequestInit) => Promise<T>;

export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  csrfToken: string | null = null,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (csrfToken && options.method && !["GET", "HEAD"].includes(options.method))
    headers.set("X-CSRF-Token", csrfToken);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new RequestError("network");
  }
  const result = (await response.json().catch(() => null)) as T & ApiError;
  if (!response.ok)
    throw new RequestError(result?.error?.code || "generic", response.status);
  return result;
}

export function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
