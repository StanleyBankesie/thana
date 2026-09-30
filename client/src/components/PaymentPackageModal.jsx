import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import api from "../api/client";
import { useAuth } from "../auth/AuthContext.jsx";

export default function PaymentPackageModal({ 
  isOpen, 
  onClose, 
  companyId, 
  defaultName = "", 
  defaultEmail = "", 
  defaultMobile = "",
  onSuccess 
}) {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchPackages() {
      try {
        const res = await api.get("/subscription-plans");
        if (res.data && Array.isArray(res.data)) {
          const activePackages = res.data.filter(p => p.status === 'ACTIVE');
          setPlans(activePackages);
          if (activePackages.length > 0) {
            setSelectedPlan(activePackages[activePackages.length - 1]); // default to last/largest
          }
        }
      } catch (err) {
        console.warn("Could not fetch payment packages:", err?.message || err);
      }
    }
    if (plans.length === 0) {
      fetchPackages();
    }
  }, [isOpen, plans.length]);

  useEffect(() => {
    if (isOpen) {
      setName(user?.full_name || user?.name || defaultName);
      setEmail(user?.email || defaultEmail);
      setMobile(defaultMobile || "");
      if (plans.length > 0 && !selectedPlan) {
        setSelectedPlan(plans[plans.length - 1]);
      }
    }
  }, [isOpen, user, defaultName, defaultEmail, defaultMobile, plans, selectedPlan]);

  if (!isOpen) return null;
  if (plans.length === 0) {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading payment packages...</p>
        </div>
      </div>
    );
  }



  const handlePay = async (e) => {
    e.preventDefault();
    const payName = name.trim();
    const payEmail = email.trim();
    const payMobile = mobile.trim();

    if (!payName || !payEmail) {
      return Swal.fire("Error", "Name and email are required.", "error");
    }

    setLoading(true);
    try {
      const payload = {
        companyId,
        name: payName,
        email: payEmail,
        plan: selectedPlan.plan_name,
        amount: selectedPlan.amount,
        duration: selectedPlan.duration_months
      };
      if (payMobile) {
        payload.mobile = payMobile;
      }

      const res = await api.post("/licenses/paystack/initialize", payload);

      if (res.data?.access_code) {
        onClose(); // close custom modal
        
        const initializeWidget = () => {
          const popup = new window.PaystackPop();
          popup.resumeTransaction(res.data.access_code, {
            onSuccess: async (transaction) => {
              Swal.fire({
                title: "Verifying Payment...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
              });
              try {
                const verifyRes = await api.get(`/licenses/paystack/verify?reference=${transaction.reference}`);
                if (verifyRes.data?.success) {
                  let successText = "License renewed successfully.";
                  if (verifyRes.data.newExpiryDate) {
                    const formattedDate = new Date(verifyRes.data.newExpiryDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                    successText += ` New validity period extends to ${formattedDate}.`;
                  }
                  Swal.fire("Success!", successText, "success").then(() => {
                    if (onSuccess) onSuccess();
                    else window.location.reload();
                  });
                } else {
                  throw new Error("Verification failed");
                }
              } catch (err) {
                Swal.fire("Error", "Payment verification failed. Please contact support.", "error");
              }
            },
            onCancel: () => {
              Swal.fire("Cancelled", "You closed the payment window.", "info");
            }
          });
        };

        if (window.PaystackPop) {
          initializeWidget();
        } else {
          const script = document.createElement("script");
          script.src = "https://js.paystack.co/v2/inline.js";
          script.onload = initializeWidget;
          document.head.appendChild(script);
        }
      }
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || "Failed to initialize payment", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Renew License</h2>
        
        <form onSubmit={handlePay} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Payment Package</label>
            <div className="space-y-3">
              {plans.map((pkg) => (
                <div key={pkg.id} className={`p-4 border rounded-xl cursor-pointer transition ${selectedPlan?.id === pkg.id ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`} onClick={() => setSelectedPlan(pkg)}>
                  <div className="flex items-center mb-2">
                    <input
                      type="radio"
                      name="plan"
                      value={pkg.id}
                      checked={selectedPlan?.id === pkg.id}
                      onChange={() => setSelectedPlan(pkg)}
                      className="mr-3 w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="font-bold text-slate-800 text-lg">{pkg.plan_name}</span>
                    <span className="ml-auto font-bold text-primary-700">GHS {pkg.amount}</span>
                  </div>
                  
                  {/* Breakdown Section */}
                  <div className="pl-7 mt-2 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between border-b border-slate-200 border-dashed pb-1">
                      <span>Cloud Hosting & Backup</span>
                      <span>GHS {pkg.cloud_hosting}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 border-dashed pb-1 pt-1">
                      <span>Support & Maintenance</span>
                      <span>GHS {pkg.support_maintenance}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Annual Software License</span>
                      <span>GHS {pkg.software_license}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hidden fields to keep them populated */}
          <input type="hidden" value={name} />
          <input type="hidden" value={email} />
          <input type="hidden" value={mobile} />

          <button 
            type="submit" 
            disabled={loading || !selectedPlan}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md disabled:opacity-50 mt-4"
          >
            {loading ? "Processing..." : `Proceed to Pay GHS ${selectedPlan?.amount || 0}`}
          </button>
        </form>
      </div>
    </div>
  );
}
