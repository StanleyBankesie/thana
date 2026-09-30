import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import {
  api,
  setScopeHeaders,
  setUserHeader,
  startPostLoginGracePeriod,
} from "../api/client.js";
import {
  clearLastActivity,
  clearStoredAuth,
  readStoredAuth,
  touchLastActivity,
  writeStoredAuth,
} from "./authStorage.js";

const AuthContext = createContext(null);

function toPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function resolveScope(userCandidate, preferredScope = {}) {
  const allowedCompanyIds = Array.isArray(userCandidate?.companyIds)
    ? userCandidate.companyIds.map((id) => Number(id)).filter((id) => id > 0)
    : [];
  const allowedBranchIds = Array.isArray(userCandidate?.branchIds)
    ? userCandidate.branchIds.map((id) => Number(id)).filter((id) => id > 0)
    : [];

  let companyId = toPositiveNumber(
    preferredScope?.companyId ??
      userCandidate?.company_id ??
      userCandidate?.companyId,
  );
  let branchId = toPositiveNumber(preferredScope?.branchId);
  if (!branchId) {
    branchId = toPositiveNumber(
      userCandidate?.branch_id ?? userCandidate?.branchId
    );
  }

  if (allowedCompanyIds.length && !allowedCompanyIds.includes(companyId)) {
    companyId = allowedCompanyIds[0] || null;
  }
  if (allowedBranchIds.length && !allowedBranchIds.includes(branchId)) {
    branchId = allowedBranchIds[0] || null;
  }

  if (!companyId) {
    companyId =
      allowedCompanyIds[0] ||
      toPositiveNumber(userCandidate?.company_id ?? userCandidate?.companyId);
  }
  if (!branchId) {
    branchId =
      allowedBranchIds[0] ||
      toPositiveNumber(userCandidate?.branch_id ?? userCandidate?.branchId);
  }

  return {
    companyId: companyId || null,
    branchId: branchId || null,
  };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [scope, setScope] = useState({ companyId: null, branchId: null });
  const [initialized, setInitialized] = useState(false);
  const [access, setAccess] = useState({ patterns: [], modules: [] });

  useLayoutEffect(() => {
    const current = readStoredAuth();
    if (current?.user && current?.token) {
      setToken(current.token);
      setUser(current.user);
      setScope(resolveScope(current.user, current.scope));
      return;
    }
    if (current) {
      clearStoredAuth();
    }
  }, []);

  useEffect(() => {
    let active = true;
    const current = readStoredAuth();

    async function validateStoredSession() {
      if (!current?.token) {
        if (current) {
          clearStoredAuth();
        }
        if (active) {
          setToken(null);
          setUser(null);
          setInitialized(true);
        }
        return;
      }

      try {
        const res = await api.get("/auth/me", {
          __skipNetworkRetry: true,
          timeout: Math.max(
            5000,
            Number(import.meta.env.VITE_AUTH_ME_TIMEOUT_MS || 45000),
          ),
        });
        const nextUser = res?.data?.user || null;
        const currentStored = readStoredAuth(); // Read fresh in case it changed
        const nextScope = resolveScope(
          nextUser,
          currentStored?.scope || current?.scope || res?.data?.scope,
        );
        if (!active) return;
        if (!nextUser?.id) {
          clearStoredAuth();
          setToken(null);
          setUser(null);
          setInitialized(true);
          return;
        }
        setUser({
          ...(current?.user || {}),
          ...nextUser,
        });
        setScope(nextScope);
        setInitialized(true);
      } catch {
        if (!active) return;
        clearStoredAuth();
        setToken(null);
        setUser(null);
        setInitialized(true);
      }
    }

    validateStoredSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      console.warn("[auth] Auth expired event received, logging out");
      clearStoredAuth();
      setToken(null);
      setUser(null);
    };

    window.addEventListener("omnisuite:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("omnisuite:auth-expired", handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!token || !user) {
      if (readStoredAuth()) {
        clearStoredAuth();
      }
      return;
    }
    const current = readStoredAuth();
    if (
      current &&
      current.token === token &&
      JSON.stringify(current.user) === JSON.stringify(user) &&
      current.scope?.companyId === scope.companyId &&
      current.scope?.branchId === scope.branchId
    ) {
      return;
    }
    writeStoredAuth({ token, user, scope });
  }, [initialized, token, user, scope]);

  useEffect(() => {
    if (user) {
      setUserHeader(user);
    }
  }, [user]);

  useEffect(() => {
    if (scope?.companyId || scope?.branchId) {
      setScopeHeaders(scope);
      const current = readStoredAuth();
      if (current) {
        writeStoredAuth({ ...current, scope });
      }
    }
  }, [scope]);

  useEffect(() => {
    const raw = user?.permissions || [];
    const normalized = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(",").map((s) => s.trim())
        : [];
    setAccess({
      patterns: normalized.filter(Boolean),
      modules: normalized.filter((p) => p && !p.includes(":") && p !== "*"),
    });
  }, [user?.permissions]);

  const login = async (credentials) => {
    try {
      const res = await api.post("/login", credentials);
      const nextUser = res.data?.user || res.data;
      const nextToken = String(res.data?.accessToken || "").trim();
      if (!nextUser || !nextUser.id) {
        throw new Error("Invalid response from server");
      }
      if (!nextToken) {
        throw new Error("Missing access token in login response");
      }
      const initialScope = resolveScope(nextUser);

      // Start grace period to suppress transient 401s from data endpoints
      // while React re-renders and flushes new requests.
      startPostLoginGracePeriod(4000);

      writeStoredAuth({
        token: nextToken,
        user: nextUser,
        scope: initialScope,
      });
      touchLastActivity();
      setToken(nextToken);
      setUser(nextUser);
      setScope(initialScope);
      return res.data;
    } catch (error) {
      clearStoredAuth();
      setToken(null);
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post("/auth/logout").catch(() => {});
      }
    } finally {
      clearStoredAuth();
      clearLastActivity();
      setToken(null);
      setUser(null);
      sessionStorage.removeItem("license_alert_dismissed");
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("active_branch_id");
        localStorage.removeItem("active_company_id");
      }
      window.location.href = "/login";
    }
  };

  const value = useMemo(
    () => ({
      token,
      user,
      scope,
      access,
      initialized,
      login,
      logout,
      setToken,
      setUser,
      setScope,
    }),
    [token, user, scope, access, initialized],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
