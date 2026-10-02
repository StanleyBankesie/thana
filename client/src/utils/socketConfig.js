export const getBackendOrigin = () => {
  let backendOrigin =
    import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_BACKEND_ORIGIN ||
    import.meta.env.VITE_API_PROXY_TARGET;

  if (!backendOrigin && import.meta.env.VITE_API_BASE_URL) {
    try {
      if (String(import.meta.env.VITE_API_BASE_URL).startsWith("http")) {
        const u = new URL(import.meta.env.VITE_API_BASE_URL);
        backendOrigin = u.origin;
      }
    } catch {}
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname.includes("thana") ||
      hostname === "thana.omnisuite-erp.com" ||
      hostname === "thanaserver.omnisuite-erp.com"
    ) {
      return "https://thanaserver.omnisuite-erp.com";
    }
    if (
      hostname.includes("seriana") ||
      hostname === "serianamart.omnisuite-erp.com" ||
      hostname === "serianaserver.omnisuite-erp.com"
    ) {
      return "https://serianaserver.omnisuite-erp.com";
    }
    if (hostname.includes("kindheart") || hostname.includes("kindtreat")) {
      return "https://kindserver.omnisuite-erp.com";
    }
    if (
      hostname === "kaf.omnisuite-erp.com" ||
      hostname === "kafserver.omnisuite-erp.com"
    ) {
      return "https://kafserver.omnisuite-erp.com";
    }
    if (
      hostname === "demo.omnisuite-erp.com" ||
      hostname === "demoserver.omnisuite-erp.com"
    ) {
      return "https://demoserver.omnisuite-erp.com";
    }

    if (hostname.endsWith(".omnisuite-erp.com")) {
      const prefix = hostname.split(".")[0];
      if (!prefix.endsWith("server")) {
        return `https://${prefix}server.omnisuite-erp.com`;
      }
      return `https://${hostname}`;
    }
  }

  return (
    backendOrigin ||
    (typeof window !== "undefined" ? window.location.origin : "")
  );
};

