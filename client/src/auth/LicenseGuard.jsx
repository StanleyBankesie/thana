import React, { useState, useEffect } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

export default function LicenseGuard({ moduleCode, children }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    async function checkAccess() {
      if (Number(user?.id) === 1) {
        if (mounted) {
          setHasAccess(true);
          setLoading(false);
        }
        return;
      }

      if (!user?.companyIds?.[0]) {
        if (mounted) {
          setHasAccess(false);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await api.get(`/licenses/company/${user.companyIds[0]}`);
        if (mounted && res?.data) {
          const l = res.data;
          
          if (!l.exists || l.status === 'EXPIRED' || l.status === 'SUSPENDED' || l.status === 'CANCELLED') {
             // Basic status block
             setHasAccess(false);
             setErrorMsg("Your company license is invalid or expired.");
             return;
          }

          if (moduleCode && (!l.modules || !l.modules.includes(moduleCode))) {
            setHasAccess(false);
            setErrorMsg(`This module (${moduleCode}) is not included in your subscription.`);
          } else {
            setHasAccess(true);
          }
        }
      } catch (err) {
        if (mounted) {
          setHasAccess(false);
          setErrorMsg("Failed to verify license module access.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    
    checkAccess();
    return () => { mounted = false; };
  }, [user, moduleCode]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Verifying Subscription...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center border-t-4 border-red-500">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5a3 3 0 110-6 3 3 0 010 6z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.history.back()}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded font-medium hover:bg-gray-200 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return children;
}
