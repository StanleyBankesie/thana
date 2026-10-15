/**
 * @fileoverview Main application component.
 * Sets up global routing, contexts (Redux, Auth, Permission, Theme), and error boundaries.
 */

import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ConfigProvider } from "antd";

import { AuthProvider } from "./auth/AuthContext.jsx";
import { PermissionProvider } from "./auth/PermissionContext.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import { GpsTrackingProvider } from "./context/GpsTrackingContext.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
const LoginPage = React.lazy(() => import("./pages/LoginPage.jsx"));
const ForgotPasswordRequest = React.lazy(() => import("./pages/ForgotPasswordRequest.jsx"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPasswordPage.jsx"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy.jsx"));
import { Provider, useDispatch } from "react-redux";
import { store } from "./store/store.js";
const BranchSelectionPage = React.lazy(() => import("./pages/BranchSelectionPage.jsx"));
import { useAuth } from "./auth/AuthContext.jsx";
import { clearGeneralCache } from "./offline/cache.js";
import { clearPosCache } from "./offline/db.js";

const AppShell = React.lazy(() => import("./layout/AppShell.jsx"));

const LoadingScreen = () => null;

/**
 * ScopedShell mounts AppShell with a React key derived from branchId.
 * Whenever the active branch changes, the key changes, React unmounts the
 * entire AppShell tree and remounts it fresh — ensuring no stale data
 * (transactions, reports, settings) from the previous branch leaks through.
 */
function ScopedShell() {
  // Component state from auth context
  const { scope, initialized } = useAuth();
  // Redux dispatch for store actions
  const dispatch = useDispatch();
  const prevBranchRef = React.useRef(scope?.branchId);

  // Reset store and clear caches on genuine branch change (not initial login)
  React.useEffect(() => {
    const prevBranch = prevBranchRef.current;
    if (initialized && scope?.branchId) {
      if (prevBranch && prevBranch !== scope?.branchId) {
        // Clear Redux Store state
        dispatch({ type: "RESET_STORE" });
        // Clear IndexedDB offline caches
        clearGeneralCache().catch(() => {});
        clearPosCache().catch(() => {});
      }
      prevBranchRef.current = scope?.branchId;
    }
  }, [scope?.branchId, initialized, dispatch]);

  const activeBranchId = scope?.branchId ?? "default";
  return <AppShell key={`branch-${activeBranchId}`} />;
}

/**
 * App component
 * The root component of the React application hierarchy.
 * Bootstraps providers, the main router, and protected layout shells.
 * 
 * @returns {JSX.Element} The rendered application component tree.
 */
export default function App() {
  // Base URL configuration for routing
  const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  const basename = base.startsWith("/") ? base : "/";
  
  // Root application providers and routing configuration
  return (
    <BrowserRouter
      basename={basename}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Provider store={store}>
        <ConfigProvider
          theme={{
            token: {
              fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            },
          }}
        >
          <ThemeProvider>
            <AuthProvider>

              <PermissionProvider>
                <GpsTrackingProvider>
                <ToastContainer position="top-right" theme="dark" />

                <React.Suspense fallback={null}>
                  <Routes>
                    <Route path="/login" element={
                      <ErrorBoundary><LoginPage /></ErrorBoundary>
                    } />
                    <Route
                      path="/forgot-password"
                      element={<ErrorBoundary><ForgotPasswordRequest /></ErrorBoundary>}
                    />
                    <Route path="/reset-password" element={<ErrorBoundary><ResetPasswordPage /></ErrorBoundary>} />
                    <Route path="/privacy-policy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
                    <Route
                      path="/select-branch"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary><BranchSelectionPage /></ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary><ScopedShell /></ErrorBoundary>
                        </ProtectedRoute>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </React.Suspense>
                </GpsTrackingProvider>
              </PermissionProvider>
            </AuthProvider>
          </ThemeProvider>
        </ConfigProvider>
      </Provider>
    </BrowserRouter>
  );
}
