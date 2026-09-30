import React, { useState } from "react";
import { toast } from "react-toastify";
import { api } from "../api/client";

/**
 * Reusable modal for sending notifications (Email, SMS, WhatsApp)
 * @param {Object} props
 * @param {boolean} props.open
 * @param {function} props.onOpenChange
 * @param {string} props.endpoint - e.g. "/api/purchase/orders/1/send-notification"
 * @param {string} props.title - Modal title (e.g. "Send Sales Order")
 * @param {function} props.onSuccess - Callback on success
 */
export default function NotificationModal({
  open,
  onOpenChange,
  endpoint,
  title = "Send Notification",
  onSuccess,
}) {
  const [selectedTypes, setSelectedTypes] = useState({
    email: true,
    sms: false,
    whatsapp: false,
  });
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleToggle = (type) => {
    setSelectedTypes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSend = async () => {
    const typesToHandle = Object.entries(selectedTypes)
      .filter(([_, isSelected]) => isSelected)
      .map(([type]) => type);

    if (typesToHandle.length === 0) {
      return toast.error("Please select at least one notification type.");
    }

    setLoading(true);
    try {
      const sendPromises = typesToHandle.map(type => 
        api.post(endpoint, { type })
      );
      
      await Promise.all(sendPromises);
      
      toast.success("Notification(s) sent successfully!");
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to send notification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[500px] max-w-[95%]">
        <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
          <div className="font-semibold">{title}</div>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-white"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-500">
            Select the channels through which you want to send this notification.
          </p>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                checked={selectedTypes.email}
                onChange={() => handleToggle("email")}
              />
              <span>Send via Email</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                checked={selectedTypes.sms}
                onChange={() => handleToggle("sms")}
              />
              <span>Send via SMS (Arkesel)</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                checked={selectedTypes.whatsapp}
                onChange={() => handleToggle("whatsapp")}
              />
              <span>Send via WhatsApp</span>
            </label>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-lg">
          <button
            className="px-4 py-2 border rounded text-slate-700 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-brand text-white rounded hover:bg-brand/90 disabled:opacity-50"
            onClick={handleSend} 
            disabled={loading}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
