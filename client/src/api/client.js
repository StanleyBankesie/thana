/**
 * @fileoverview Axios API client configuration.
 * Sets up base URL, interceptors, and handles token refresh logic.
 */

import axios from "axios";
import { queueMutation, getQueueSnapshot } from "../offline/syncEngine.js";
import {
  putCache,
  getCache,
  deleteCacheByUrlPrefixes,
} from "../offline/cache.js";
import {
  touchLastActivity,
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from "../auth/authStorage.js";

const AXIOS_TIMEOUT_MS = Math.max(
  5000,
  Number(import.meta.env.VITE_AXIOS_TIMEOUT_MS || 45000),
);
const WARM_CACHE_MAX_AGE_MS = Math.max(
  0,
  Number(import.meta.env.VITE_WARM_CACHE_MAX_AGE_MS || 30 * 60 * 1000),
);

// State to track post-login grace period
let _postLoginGraceUntil = 0;

export function startPostLoginGracePeriod(durationMs = 4000) {
  _postLoginGraceUntil = Date.now() + durationMs;
}

/**
 * Core Axios instance for making authenticated requests to the backend API.
 * Includes credentials by default and automatically normalizes JSON payloads.
 */
export const api = axios.create({
  withCredentials: false,
  timeout: AXIOS_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
  transformRequest: [
    (data, headers) => {
      if (data && typeof data === "object" && !(data instanceof FormData)) {
        return JSON.stringify(data);
      }
      return data;
    },
  ],
});

let API_BASE = import.meta.env.VITE_API_BASE_URL;

if (
  typeof window !== "undefined" &&
  (window.location.hostname.includes("thana") ||
    window.location.hostname === "thana.omnisuite-erp.com" ||
    window.location.hostname === "thanaserver.omnisuite-erp.com")
) {
  API_BASE = "https://thanaserver.omnisuite-erp.com/api";
} else if (
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".omnisuite-erp.com")
) {
  const prefix = window.location.hostname.split(".")[0];
  if (!prefix.endsWith("server")) {
    API_BASE = `https://${prefix}server.omnisuite-erp.com/api`;
  }
} else if (!API_BASE) {
  // Default to same-origin so Vite dev proxy handles local API traffic.
  API_BASE = "/api";
} else if (
  API_BASE &&
  !API_BASE.startsWith("http") &&
  !API_BASE.startsWith("/")
) {
  API_BASE = "/" + API_BASE;
}
api.defaults.baseURL = API_BASE;

let _syncStarted = false;
function ensureSyncEngine() {
  if (_syncStarted) return;
  _syncStarted = true;
  import("../offline/syncEngine.js").then(({ startSyncEngine }) =>
    startSyncEngine(),
  );
}

function normalizeUrl(url) {
  if (!url) return "";
  try {
    const base = api.defaults.baseURL || window.location.origin;
    const parsed = new URL(url.startsWith("http") ? url : `${base}${url}`);
    let path = parsed.pathname;
    if (path.startsWith("/api")) {
      path = path.substring(4);
    }
    return path;
  } catch {
    return String(url).trim();
  }
}

function isUnauthenticatedEndpoint(url) {
  const value = normalizeUrl(url);
  return [
    "/register",
    "/login",
    "/auth/logout",
    "/auth/refresh",
    "/forgot-password/request-otp",
    "/forgot-password/reset",
    "/subscription-plans",
  ].includes(value);
}

const NON_FATAL_401_PREFIXES = [
  // Explicitly non-fatal: these endpoints return 401 in some edge-case
  // contexts (e.g. user lacks a role, superadmin-only) and should NEVER
  // trigger a logout.
  "/subscription-plans",
  "/admin/user-permissions",
  "/admin/users/",
  "/admin/page-permissions",
  "/access/dashboard-permissions",
  "/push/public-key",
  // Initial-load data fetches: these endpoints fire immediately after login
  // from various components. If the session cookie is momentarily not yet
  // available on the proxy or the scope headers haven\'t been set by the
  // first render cycle, a transient 401 should NOT log the user out.
  // The AuthContext already validates the real session via GET /auth/me;
  // that is the authoritative auth check.
  "/social-feed",
  "/access/features",
  "/admin/me",
  "/workflows/approvals/pending",
  "/workflows/",
  "/access/",
  "/notifications",
];

function isNonFatal401Endpoint(url) {
  const value = normalizeUrl(url);
  return NON_FATAL_401_PREFIXES.some((p) => value.startsWith(p));
}

const WARM_CACHE_EXCLUDED_PREFIXES = [
  "/auth/",
  "/push/",
  "/notifications",
  "/workflows/notifications",
  "/inventory/alerts/",
  "/admin/me",
  "/admin/user-permissions",
  "/admin/page-permissions",
  "/access/",
  "/social-feed",
  "/finance/tax-codes",
  "/finance/setup/",
];

function isWarmCacheEligible(url, config, cachedEntry) {
  if (config?.__background === true || config?.__skipWarmCache === true) {
    return false;
  }
  const value = normalizeUrl(url);
  if (!value || value === "/auth/me") return false;
  if (WARM_CACHE_EXCLUDED_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return false;
  }
  if (!cachedEntry || typeof cachedEntry !== "object") return false;
  if (
    WARM_CACHE_MAX_AGE_MS > 0 &&
    Date.now() - Number(cachedEntry.updatedAt || 0) > WARM_CACHE_MAX_AGE_MS
  ) {
    return false;
  }
  const cachedData = cachedEntry.data;
  if (Array.isArray(cachedData?.items)) return true;
  if (
    cachedData &&
    typeof cachedData === "object" &&
    cachedData.pagination &&
    Array.isArray(cachedData.items)
  ) {
    return true;
  }
  return false;
}

function buildCachedGetResponse(config, data, meta = {}) {
  return {
    data,
    status: 200,
    statusText: "OK (warm cache)",
    headers: {},
    config: {
      ...config,
      __servedFromWarmCache: true,
      __cacheUpdatedAt: Number(meta.updatedAt || 0),
    },
  };
}

function buildInvalidationPrefixes(url) {
  const value = normalizeUrl(url);
  if (!value) return [];
  const parts = value.split("/").filter(Boolean);
  if (!parts.length) return [];
  if (parts[0] === "auth" || parts[0] === "push") return [];

  const prefixes = new Set([value]);
  if (parts.length >= 2) {
    prefixes.add(`/${parts[0]}/${parts[1]}`);
  } else {
    prefixes.add(`/${parts[0]}`);
  }

  return Array.from(prefixes);
}

api.interceptors.request.use(
  (config) => {
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
    }

    const urlPath = normalizeUrl(config.url);
    const method = String(config?.method || "get").toLowerCase();

    if (method === "get") {
      // Remove Content-Type from GET requests. ModSecurity strictly blocks GET requests
      // that contain a Content-Type header as a Protocol Anomaly / Request Smuggling risk.
      if (config.headers) {
        delete config.headers["Content-Type"];
        delete config.headers["content-type"];
      }

      if (
        typeof config.__background === "undefined" &&
        _postLoginGraceUntil > Date.now() &&
        urlPath !== "/auth/me"
      ) {
        config.__background = true;
      }
    }

    const needsCookieCredentials =
      urlPath === "/login" ||
      urlPath === "/auth/refresh" ||
      urlPath === "/auth/logout";
    if (needsCookieCredentials) {
      config.withCredentials = true;
    }

    const storedAuth = readStoredAuth();
    const accessToken = String(storedAuth?.token || "").trim();
    if (accessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
      delete config.headers["X-Access-Token"];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.request.use(
  async (config) => {
    if (!config.baseURL) {
      config.baseURL = api.defaults.baseURL;
    }

    ensureSyncEngine();

    // Attach a cache key for GET requests
    const method = String(config.method || "get").toLowerCase();
    if (method === "get") {
      try {
        const base = api.defaults.baseURL;
        const url = new URL(
          config.url.startsWith("http") ? config.url : `${base}${config.url}`,
          window.location.origin,
        );
        if (config.params && typeof config.params === "object") {
          Object.entries(config.params).forEach(([k, v]) =>
            url.searchParams.set(k, String(v)),
          );
        }
        config.__cacheKey = `GET:${url.toString()}`;
      } catch {}
    }
    if (["post", "put", "patch", "delete"].includes(method)) {
      const skipOffline =
        config?.__skipOfflineQueue === true ||
        config?.headers?.["x-skip-offline-queue"] === "1" ||
        config?.headers?.["x-skip-offline-queue"] === 1 ||
        config?.headers?.["x-skip-offline-queue"] === true;
      if (
        typeof navigator !== "undefined" &&
        !navigator.onLine &&
        !skipOffline
      ) {
        const queued = await queueMutation({
          method,
          url: config.url,
          data: config.data,
          headers: config.headers,
        });
        return Promise.reject({
          isOfflineQueued: true,
          queued,
          config,
          snapshot: getQueueSnapshot(),
        });
      }
    }
    if (
      method === "get" &&
      typeof navigator !== "undefined" &&
      !navigator.onLine &&
      config.__cacheKey
    ) {
      const cached = await getCache(config.__cacheKey);
      if (cached && cached.data) {
        return Promise.reject({
          isOfflineCached: true,
          cached: cached.data,
          config,
        });
      }
    }
    touchLastActivity();
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // Cache GET responses for offline usage (skip for blob/non-JSON data)
    try {
      const method = String(response?.config?.method || "get").toLowerCase();
      const isBlob = response.data instanceof Blob;
      if (method === "get" && response?.config?.__cacheKey && !isBlob) {
        // Fire and forget - don't await caching, just attempt it
        putCache(response.config.__cacheKey, response.data || null).catch(
          (error) => {
            // Silently ignore caching errors - don't block response
            console.debug("Cache store error (non-critical):", error.message);
          },
        );
      }
      if (["post", "put", "patch", "delete"].includes(method)) {
        const prefixes = buildInvalidationPrefixes(response?.config?.url);
        if (prefixes.length) {
          deleteCacheByUrlPrefixes(prefixes).catch((error) => {
            console.debug(
              "Cache invalidation error (non-critical):",
              error.message,
            );
          });
        }
      }
    } catch (error) {
      // Silently ignore cache setup errors
      console.debug("Cache setup error (non-critical):", error.message);
    }
    if (response && typeof response === "object") {
      return response;
    }
    return {
      data: response,
      status: 200,
      statusText: "OK",
      headers: {},
      config: response?.config || {},
    };
  },
  async (error) => {
    if (error && error.isOfflineQueued) {
      return Promise.resolve({
        data: {
          queued: true,
          offline: true,
          id: error.queued?.id,
          snapshot: error.snapshot,
        },
        status: 202,
        statusText: "Accepted (queued)",
        headers: {},
        config: error.config,
      });
    }
    if (error && error.isOfflineCached) {
      return Promise.resolve({
        data: error.cached,
        status: 200,
        statusText: "OK (cached)",
        headers: {},
        config: error.config,
      });
    }
    const originalRequest = error?.config || {};
    const requestUrl = normalizeUrl(originalRequest.url);

    if (error?.response?.status === 401) {
      const canAttemptRefresh =
        !originalRequest.__isRetryAfterRefresh &&
        requestUrl !== "/auth/refresh" &&
        !isUnauthenticatedEndpoint(requestUrl);

      if (canAttemptRefresh) {
        try {
          const nextToken = await refreshSessionToken();
          if (nextToken) {
            originalRequest.__isRetryAfterRefresh = true;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${nextToken}`;
            return _origRequest(originalRequest);
          }
        } catch {}
      }
    }

    if (error?.response?.status === 401) {
      if (!isNonFatal401Endpoint(requestUrl)) {
        // Suppress auth-expired events during the post-login grace window.
        // Right after login, multiple components fire requests in parallel.
        // Some of these may transiently return 401 before the session is
        // fully propagated (scope headers not yet set, proxy not yet flushed,
        // etc.). We validate the real session via GET /auth/me in AuthContext;
        // that is the authoritative check. Transient 401s on data endpoints
        // during the first few seconds after login should not trigger logout.
        const isInGraceWindow = _postLoginGraceUntil > Date.now();

        if (
          !isInGraceWindow &&
          typeof window !== "undefined" &&
          window.location.pathname !== "/login"
        ) {
          window.dispatchEvent(new CustomEvent("omnisuite:auth-expired"));
        }

        if (!isUnauthenticatedEndpoint(requestUrl)) {
          clearStoredAuth();
        }
      }
    }

    return Promise.reject({
      message: error.message,
      response: error.response,
      config: error.config,
      isAxiosError: true,
    });
  },
);

export function setScopeHeaders({ companyId, branchId }) {
  if (companyId)
    api.defaults.headers.common["x-company-id"] = String(companyId);
  if (branchId) api.defaults.headers.common["x-branch-id"] = String(branchId);
}

export function setUserHeader(user) {
  const candidate =
    user && typeof user.id !== "undefined"
      ? Number(user.id)
      : user && typeof user.sub !== "undefined"
        ? Number(user.sub)
        : null;
  if (candidate && Number.isFinite(candidate)) {
    api.defaults.headers.common["x-user-id"] = String(candidate);
  } else {
    delete api.defaults.headers.common["x-user-id"];
  }
}

/** Coalesce duplicate in-flight GET requests to reduce concurrent server load */
const inflightGets = new Map();
const MAX_CONCURRENT_GETS = Math.max(
  1,
  Number(import.meta.env.VITE_MAX_CONCURRENT_GETS || 1), // Reduced to 1 to bypass strict ModSecurity rules
);
const GET_RETRY_LIMIT = Math.max(
  0,
  Number(import.meta.env.VITE_GET_RETRY_LIMIT || 2),
);
const FOREGROUND_GET_CONCURRENCY = Math.max(
  1,
  Number(
    import.meta.env.VITE_FOREGROUND_GET_CONCURRENCY || MAX_CONCURRENT_GETS,
  ),
);
const BACKGROUND_GET_CONCURRENCY = Math.max(
  1,
  Number(import.meta.env.VITE_BACKGROUND_GET_CONCURRENCY || 1),
);
const queuedForegroundGets = [];
const queuedBackgroundGets = [];
let activeForegroundGetCount = 0;
let activeBackgroundGetCount = 0;
const warmCacheRefreshes = new Map();

const _origRequest = api.request.bind(api);
let refreshPromise = null;

async function refreshSessionToken() {
  if (!refreshPromise) {
    refreshPromise = _origRequest({
      method: "post",
      url: "/auth/refresh",
      __isRetryAfterRefresh: true,
      __skipNetworkRetry: true,
    })
      .then((response) => {
        const nextToken = String(response?.data?.accessToken || "").trim();
        if (!nextToken) {
          throw new Error("Missing access token in refresh response");
        }
        const current = readStoredAuth() || {};
        writeStoredAuth({
          ...current,
          token: nextToken,
        });
        return nextToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function normalizeGetPriority(config) {
  return config?.__background === true ? "background" : "foreground";
}

function dequeueNextGet(priority = "foreground") {
  if (priority === "background") {
    if (activeBackgroundGetCount >= BACKGROUND_GET_CONCURRENCY) return;
    if (
      activeForegroundGetCount + activeBackgroundGetCount >=
      MAX_CONCURRENT_GETS
    ) {
      return;
    }
    const next = queuedBackgroundGets.shift();
    if (typeof next === "function") next();
    return;
  }

  if (activeForegroundGetCount >= FOREGROUND_GET_CONCURRENCY) return;
  if (
    activeForegroundGetCount + activeBackgroundGetCount >=
    MAX_CONCURRENT_GETS
  ) {
    return;
  }
  const next = queuedForegroundGets.shift();
  if (typeof next === "function") next();
}

function flushQueuedGets() {
  let progressed = true;
  while (progressed) {
    const before =
      activeForegroundGetCount +
      activeBackgroundGetCount +
      queuedForegroundGets.length +
      queuedBackgroundGets.length;

    dequeueNextGet("foreground");
    dequeueNextGet("background");

    const after =
      activeForegroundGetCount +
      activeBackgroundGetCount +
      queuedForegroundGets.length +
      queuedBackgroundGets.length;
    progressed = after < before;
  }
}

function enqueueGet(work, priority = "foreground") {
  return new Promise((resolve, reject) => {
    const run = () => {
      if (priority === "background") {
        activeBackgroundGetCount += 1;
      } else {
        activeForegroundGetCount += 1;
      }
      Promise.resolve()
        .then(work)
        .then(resolve, reject)
        .finally(() => {
          if (priority === "background") {
            activeBackgroundGetCount = Math.max(
              0,
              activeBackgroundGetCount - 1,
            );
          } else {
            activeForegroundGetCount = Math.max(
              0,
              activeForegroundGetCount - 1,
            );
          }
          flushQueuedGets();
        });
    };

    const totalActive = activeForegroundGetCount + activeBackgroundGetCount;
    const withinPriorityLimit =
      priority === "background"
        ? activeBackgroundGetCount < BACKGROUND_GET_CONCURRENCY
        : activeForegroundGetCount < FOREGROUND_GET_CONCURRENCY;

    if (totalActive < MAX_CONCURRENT_GETS && withinPriorityLimit) {
      run();
      return;
    }

    if (priority === "background") {
      queuedBackgroundGets.push(run);
    } else {
      queuedForegroundGets.push(run);
    }
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGet(error, attempt) {
  if (attempt >= Math.max(GET_RETRY_LIMIT, 3)) return false; // Ensure we retry at least 3 times
  if (
    error?.response?.status === 500 ||
    error?.response?.status === 502 ||
    error?.response?.status === 403
  )
    return true; // Retry on server/WAF errors
  if (error?.response) return false;
  const msg = String(error?.message || "").toLowerCase();
  if (error?.code === "ECONNABORTED" || msg.includes("timeout of"))
    return false;
  if (error?.config?.__skipNetworkRetry === true) return false;
  return true;
}

async function runGetRequest(url, config) {
  let attempt = 0;
  const priority = normalizeGetPriority(config);
  while (true) {
    try {
      return await enqueueGet(
        () => _origRequest({ method: "get", url, ...config }),
        priority,
      );
    } catch (error) {
      if (!shouldRetryGet(error, attempt)) {
        throw error;
      }
      attempt += 1;
      await delay(250 * attempt);
    }
  }
}

function dispatchWarmCacheRefresh(cacheKey, url, response) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("omni:warm-cache-refreshed", {
        detail: {
          cacheKey,
          url: normalizeUrl(url),
          refreshedAt: Date.now(),
          itemCount: Array.isArray(response?.data?.items)
            ? response.data.items.length
            : null,
        },
      }),
    );
  } catch {}
}

function scheduleWarmCacheRefresh(url, config, cacheKey) {
  if (warmCacheRefreshes.has(cacheKey)) {
    return warmCacheRefreshes.get(cacheKey);
  }
  const refreshPromise = runGetRequest(url, {
    ...config,
    __background: true,
    __skipWarmCache: true,
  })
    .then((response) => {
      dispatchWarmCacheRefresh(cacheKey, url, response);
      return response;
    })
    .finally(() => {
      warmCacheRefreshes.delete(cacheKey);
    });
  warmCacheRefreshes.set(cacheKey, refreshPromise);
  return refreshPromise;
}

api.get = function (url, config) {
  try {
    const base = api.defaults.baseURL;
    const fullUrl = new URL(
      url.startsWith("http") ? url : `${base}${url}`,
      window.location.origin,
    );
    const params = config?.params || {};
    Object.entries(params).forEach(([k, v]) =>
      fullUrl.searchParams.set(k, String(v)),
    );
    const cacheKey = `GET:${fullUrl.toString()}`;

    const existing = inflightGets.get(cacheKey);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      if (
        typeof navigator !== "undefined" &&
        navigator.onLine !== false &&
        config?.__skipWarmCache !== true
      ) {
        const cached = await getCache(cacheKey);
        if (isWarmCacheEligible(url, config, cached)) {
          scheduleWarmCacheRefresh(url, config, cacheKey).catch(() => {});
          return buildCachedGetResponse(
            {
              ...config,
              method: "get",
              url,
              __cacheKey: cacheKey,
            },
            cached.data,
            cached,
          );
        }
      }

      return runGetRequest(url, config);
    })();
    inflightGets.set(cacheKey, promise);
    promise
      .finally(() => {
        setTimeout(() => inflightGets.delete(cacheKey), 200);
      })
      .catch(() => {});
    return promise;
  } catch {
    return _origRequest({ method: "get", url, ...config });
  }
};

api.request = function (config) {
  const method = String(config?.method || "get").toLowerCase();
  if (method === "get") {
    return api.get(config.url, { ...config, method: undefined });
  }
  return _origRequest(config);
};

export default api;
