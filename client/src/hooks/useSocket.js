/**
 * @fileoverview React hook for initializing and managing a global Socket.io connection.
 * Handles authentication injection and singleton socket instancing across the SPA.
 */

import { useEffect, useState } from "react";
import io from "socket.io-client";
import { useAuth } from "../auth/AuthContext";
import { getBackendOrigin } from "../utils/socketConfig";

/**
 * Hook to manage Socket.io connection
 * Automatically connects/disconnects and handles auth
 */
export function useSocket() {
  const [socket, setSocket] = useState(null);
  const { user, scope, token } = useAuth();
  const storage =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  const userId = (user && (user.id || user.sub)) || "";
  const branchId =
    (scope && scope.branchId) || storage?.getItem("warehouseId") || "";
  const authKey = `${userId}|${branchId}|${String(token || "")}`;

  // Singleton socket across the app to avoid multiple connections
  // when multiple components use this hook simultaneously.
  // Dev StrictMode mounts/unmounts twice; refcount prevents premature close.
  // These variables live for the lifetime of the module.
  // eslint-disable-next-line no-undef
  if (typeof window !== "undefined") {
    window.__omniSocketGlobal__ = window.__omniSocketGlobal__ || {
      socket: null,
      users: 0,
      authKey: "",
    };
  }
  const globalHolder =
    typeof window !== "undefined" ? window.__omniSocketGlobal__ : null;

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    // Reuse global socket if exists
    if (
      globalHolder &&
      globalHolder.socket &&
      globalHolder.authKey === authKey
    ) {
      setSocket(globalHolder.socket);
      globalHolder.users += 1;
      return () => {
        if (globalHolder) {
          globalHolder.users = Math.max(0, globalHolder.users - 1);
        }
      };
    }

    if (globalHolder && globalHolder.socket) {
      try {
        globalHolder.socket.close();
      } catch {}
      globalHolder.socket = null;
      globalHolder.users = 0;
      globalHolder.authKey = "";
    }

    const backendOrigin = getBackendOrigin();

    const transportPref = (
      import.meta.env.VITE_SOCKET_TRANSPORT || ""
    ).toLowerCase();
    
    // Default to HTTP polling to guarantee 100% compatibility with Plesk, Phusion Passenger, and reverse proxies without requiring WebSocket upgrades
    const transports = transportPref === "websocket" 
      ? ["websocket", "polling"] 
      : ["polling"];
      
    const disableSockets = import.meta.env.VITE_DISABLE_SOCKETS === "true";

    if (disableSockets) {
      console.log("Socket.io is disabled in this environment.");
      const dummySocket = {
        on: () => {},
        off: () => {},
        emit: () => {},
        disconnect: () => {},
        connect: () => {},
        id: "dummy-socket",
      };
      setSocket(dummySocket);
      return;
    }

    const newSocket = io(backendOrigin, {
      path: "/socket.io",
      withCredentials: true,
      auth: {
        token,
      },
      query: {
        userId: userId || storage?.getItem("userId") || "",
        warehouseId: branchId,
      },
      reconnection: true,
      reconnectionDelay: 3000, // Start with 3 second delay
      reconnectionDelayMax: 30000, // Max 30 second delay
      reconnectionAttempts: Infinity,
      timeout: 60000, // Wait 60 seconds for connect timeout
      transports,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to Socket.io");
      try {
        if (typeof window !== "undefined") {
          window.__omniSocketConnected = true;
        }
      } catch {}
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.io");
      try {
        if (typeof window !== "undefined") {
          window.__omniSocketConnected = false;
        }
      } catch {}
    });

    newSocket.on("error", (error) => {
      console.error("Socket.io error:", error);
    });

    // Keep socket stable across SPA navigation; only close on full unload
    if (typeof window !== "undefined") {
      const unloadHandler = () => {
        try {
          newSocket.close();
        } catch {}
      };
      window.addEventListener("beforeunload", unloadHandler);
      newSocket.on("connect_error", () => {
        // Maintain reconnection strategy
        try {
          newSocket.io.opts.reconnectionDelayMax = 30000;
        } catch {}
      });
    }

    setSocket(newSocket);
    if (globalHolder) {
      globalHolder.socket = newSocket;
      globalHolder.users = 1;
      globalHolder.authKey = authKey;
    }

    return () => {
      if (globalHolder) {
        globalHolder.users = Math.max(0, globalHolder.users - 1);
      }
    };
  }, [authKey, token, userId, branchId]);

  return socket;
}

export default useSocket;
