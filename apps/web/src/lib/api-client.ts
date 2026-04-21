import { env } from "@/lib/env";
import type { ApiEnvelope, ApiErrorBody, AuthUserSnapshot } from "@/lib/types";

export class ApiClientError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

interface CreateApiClientArgs {
  getAccessToken: () => Promise<string | null>;
  getMockUser: () => AuthUserSnapshot | null;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, env.apiBaseUrl.endsWith("/") ? env.apiBaseUrl : `${env.apiBaseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseErrorBody(response: Response): Promise<ApiClientError> {
  let payload: ApiErrorBody | null = null;
  try {
    payload = (await response.json()) as ApiErrorBody;
  } catch {
    payload = null;
  }
  const fallback = `Request failed with status ${response.status}`;
  const message = payload?.error?.message ?? fallback;
  return new ApiClientError(message, payload?.error?.statusCode ?? response.status, payload?.error?.details);
}

export function createApiClient({ getAccessToken, getMockUser }: CreateApiClientArgs) {
  async function request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options?: RequestOptions
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json"
    };
    const accessToken = await getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const mockUser = getMockUser();
    if (env.mockAuthEnabled && mockUser) {
      headers["x-user-id"] = mockUser.id;
      headers["x-user-email"] = mockUser.email;
      headers["x-user-name"] = mockUser.name;
    }
    const response = await fetch(buildUrl(path, options?.query), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
      throw await parseErrorBody(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const payload = (await response.json()) as ApiEnvelope<T>;
    return payload.data;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
    post: <T>(path: string, options?: RequestOptions) => request<T>("POST", path, options),
    patch: <T>(path: string, options?: RequestOptions) => request<T>("PATCH", path, options),
    delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options)
  };
}
