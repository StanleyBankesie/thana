/**
 * @fileoverview Global Toast & Alert Sanitizer.
 * Intercepts all toast.error, message.error, and Swal.fire calls to ensure:
 * 1. Offline, network disconnection, or unreachable backend/server issues display "No internet access".
 * 2. System and server errors never display "Internal server error", but instead display the actual meaningful error message.
 */

import { toast } from "react-toastify";
import { message as antdMessage } from "antd";
import Swal from "sweetalert2";

/**
 * Checks if the browser or request indicates offline or unreachable server.
 */
export function isNetworkOrUnreachable(errorOrText) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (!errorOrText) return false;

  if (typeof errorOrText === "object") {
    if (errorOrText.isOffline === true || errorOrText.offline === true) {
      return true;
    }
    if (!errorOrText.response && (errorOrText.isAxiosError || errorOrText.config)) {
      return true;
    }
    const status = Number(errorOrText.response?.status) || 0;
    if (status === 0 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    const code = String(errorOrText.code || "").toUpperCase();
    if (
      code === "ERR_NETWORK" ||
      code === "ECONNREFUSED" ||
      code === "ENOTFOUND" ||
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED" ||
      code === "EHOSTUNREACH" ||
      code === "ENETUNREACH"
    ) {
      return true;
    }
    const msg = String(errorOrText.message || "");
    if (
      /network\s*error/i.test(msg) ||
      /failed\s*to\s*fetch/i.test(msg) ||
      /load\s*failed/i.test(msg) ||
      /connection\s*refused/i.test(msg)
    ) {
      return true;
    }
    const data = errorOrText.response?.data;
    if (typeof data === "string") {
      if (
        /502\s*bad\s*gateway/i.test(data) ||
        /503\s*service\s*unavailable/i.test(data) ||
        /504\s*gateway\s*time-?out/i.test(data) ||
        /web\s*server\s*is\s*down/i.test(data) ||
        /backend\s*connection\s*failed/i.test(data)
      ) {
        return true;
      }
    }
    return false;
  }

  const str = String(errorOrText);
  return (
    /network\s*error/i.test(str) ||
    /failed\s*to\s*fetch/i.test(str) ||
    /load\s*failed/i.test(str) ||
    /err_network/i.test(str) ||
    /econnrefused/i.test(str) ||
    /enotfound/i.test(str) ||
    /connection\s*refused/i.test(str) ||
    /502\s*bad\s*gateway/i.test(str) ||
    /503\s*service\s*unavailable/i.test(str) ||
    /504\s*gateway\s*time-?out/i.test(str) ||
    /web\s*server\s*is\s*down/i.test(str) ||
    /server\s*(?:is\s*)?(?:down|unreachable)/i.test(str)
  );
}

/**
 * Sanitizes any error message, object, or string to conform to:
 * - "No internet access" when offline or unable to reach backend.
 * - Meaningful error messages instead of "Internal server error".
 */
export function sanitizeToastContent(content) {
  // If browser is offline, prioritize "No internet access"
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "No internet access";
  }

  if (content == null) {
    return "An error occurred. Please try again.";
  }

  // Handle object / Error inputs
  if (typeof content === "object") {
    // If it's a React element, do not modify
    if (content.$$typeof || content._owner) {
      return content;
    }

    if (isNetworkOrUnreachable(content)) {
      return "No internet access";
    }

    const candidate =
      content.response?.data?.message ||
      content.response?.data?.error ||
      content.response?.data?.detail ||
      content.response?.data?.sqlMessage ||
      content.message;

    if (candidate && candidate !== content) {
      return sanitizeToastContent(candidate);
    }

    return "An error occurred while processing your request. Please try again.";
  }

  let text = String(content).trim();

  // Check network / unreachable patterns
  if (isNetworkOrUnreachable(text)) {
    return "No internet access";
  }

  // Check for "Internal server error"
  if (/internal\s*server\s*error/i.test(text)) {
    // Check if network is disconnected or server is down
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "No internet access";
    }

    // Remove internal server error prefixes/suffixes
    const cleaned = text
      .replace(/^(?:error:\s*)?internal\s*server\s*error[\s!.]*$/i, "")
      .replace(/^request\s*failed\s*with\s*status\s*code\s*500:?\s*internal\s*server\s*error[\s!.]*$/i, "")
      .replace(/^request\s*failed\s*with\s*status\s*code\s*500:?\s*/i, "")
      .trim();

    if (!cleaned || /internal\s*server\s*error/i.test(cleaned)) {
      return "An error occurred while processing your request. Please try again.";
    }

    return cleaned.replace(/internal\s*server\s*error/gi, "processing error");
  }

  // Remove generic "Request failed with status code 500"
  if (/^request\s*failed\s*with\s*status\s*code\s*500$/i.test(text)) {
    return "An error occurred while processing your request. Please try again.";
  }

  return text;
}

// 1. Monkey-patch react-toastify toast.error
if (toast && typeof toast.error === "function") {
  const origToastError = toast.error.bind(toast);
  toast.error = function (content, options) {
    const sanitized = sanitizeToastContent(content);
    const opts = { ...(options || {}) };
    if (sanitized === "No internet access" && !opts.toastId) {
      opts.toastId = "no-internet-access";
    }
    return origToastError(sanitized, opts);
  };
}

// 2. Monkey-patch Ant Design message.error
if (antdMessage && typeof antdMessage.error === "function") {
  const origAntdError = antdMessage.error.bind(antdMessage);
  antdMessage.error = function (content, ...rest) {
    if (typeof content === "object" && content !== null && !content.$$typeof) {
      if (content.content) {
        content = { ...content, content: sanitizeToastContent(content.content) };
      }
      return origAntdError(content, ...rest);
    }
    return origAntdError(sanitizeToastContent(content), ...rest);
  };
}

// 3. Monkey-patch SweetAlert2 Swal.fire
if (Swal && typeof Swal.fire === "function") {
  const origSwalFire = Swal.fire.bind(Swal);
  Swal.fire = function (...args) {
    try {
      if (args.length >= 2 && (args[2] === "error" || args[0] === "Error")) {
        args[1] = sanitizeToastContent(args[1]);
      } else if (typeof args[0] === "object" && args[0] !== null) {
        if (args[0].icon === "error") {
          if (args[0].text) {
            args[0] = { ...args[0], text: sanitizeToastContent(args[0].text) };
          }
          if (args[0].title && /internal\s*server\s*error/i.test(args[0].title)) {
            args[0] = { ...args[0], title: "Operation Failed" };
          }
        }
      }
    } catch {}
    return origSwalFire(...args);
  };
}

// 4. Global window offline listener
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    toast.error("No internet access", {
      toastId: "no-internet-access",
      autoClose: 5000,
    });
  });
}

export default sanitizeToastContent;
