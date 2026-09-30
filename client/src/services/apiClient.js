/**
 * @fileoverview A wrapper around the core Axios API client.
 * Provides helper methods to normalize responses by extracting the inner 'data' payload.
 */

import { api } from "../api/client.js";

function normalizeResponse(res) {
  const data = res?.data;
  if (data && data.data && typeof data.data === "object") return data.data;
  return data || {};
}

/**
 * apiClient service
 * Exports normalized HTTP methods (get, post, put, patch, delete) to simplify component code.
 */
export const apiClient = {
  get: async (url, config) => {
    const res = await api.get(url, config);
    return normalizeResponse(res);
  },
  post: async (url, body, config) => {
    const res = await api.post(url, body, config);
    return normalizeResponse(res);
  },
  put: async (url, body, config) => {
    const res = await api.put(url, body, config);
    return normalizeResponse(res);
  },
  patch: async (url, body, config) => {
    const res = await api.patch(url, body, config);
    return normalizeResponse(res);
  },
  delete: async (url, config) => {
    const res = await api.delete(url, config);
    return normalizeResponse(res);
  },
};

export default apiClient;
