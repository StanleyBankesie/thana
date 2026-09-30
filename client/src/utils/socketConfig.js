export const getBackendOrigin = () => {
  let backendOrigin = import.meta.env.VITE_API_PROXY_TARGET || window.location.origin;
  
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("seriana") || hostname === "serianamart.omnisuite-erp.com" || hostname === "serianaserver.omnisuite-erp.com") {
      backendOrigin = "https://serianaserver.omnisuite-erp.com";
    } else if (hostname.includes("kindheart") || hostname.includes("kindtreat")) {
      backendOrigin = "https://kindserver.omnisuite-erp.com";
    } else if (hostname === "kaf.omnisuite-erp.com" || hostname === "kafserver.omnisuite-erp.com") {
      backendOrigin = "https://kafserver.omnisuite-erp.com";
    } else if (hostname === "demo.omnisuite-erp.com" || hostname === "demoserver.omnisuite-erp.com") {
      backendOrigin = "https://demoserver.omnisuite-erp.com";
    }
  }
  
  return backendOrigin;
};
