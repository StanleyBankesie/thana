import React from "react";
import ReactDOMServer from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.js";
import { AuthProvider } from "./client/src/auth/AuthContext.jsx";
import { PermissionProvider } from "./client/src/auth/PermissionContext.jsx";
import ServiceOrdersList from "./client/src/pages/modules/service-management/service-orders/ServiceOrdersList.jsx";
import PurchaseOrdersLocalList from "./client/src/pages/modules/purchase/purchase-orders-local/PurchaseOrdersLocalList.jsx";

try {
  const html1 = ReactDOMServer.renderToString(
    <StaticRouter location="/service-orders">
      <AuthProvider>
        <PermissionProvider>
          <ServiceOrdersList />
        </PermissionProvider>
      </AuthProvider>
    </StaticRouter>
  );
  console.log("ServiceOrdersList rendered successfully:", html1.substring(0, 100));

  const html2 = ReactDOMServer.renderToString(
    <StaticRouter location="/purchase-orders-local">
      <AuthProvider>
        <PermissionProvider>
          <PurchaseOrdersLocalList />
        </PermissionProvider>
      </AuthProvider>
    </StaticRouter>
  );
  console.log("PurchaseOrdersLocalList rendered successfully:", html2.substring(0, 100));

} catch (err) {
  console.error("Crash during render:", err);
}
