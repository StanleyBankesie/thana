import React, { useState } from "react";
import { toast } from "react-toastify";
import { Bell, Loader2 } from "lucide-react";
import { api } from "../api/client";
import Modal from "./common/Modal.jsx";

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
      const sendPromises = typesToHandle.map((type) =>
        api.post(endpoint, { type }),
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
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      subtitle="Select the channels through which you want to send this notification"
      icon={Bell}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            className="btn btn-secondary px-4 py-2 text-sm font-medium"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary px-5 py-2 text-sm font-medium inline-flex items-center gap-2"
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
          <input
            type="checkbox"
            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            checked={selectedTypes.email}
            onChange={() => handleToggle("email")}
          />
          <span className="font-medium text-slate-800 dark:text-slate-200">Send via Email</span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
          <input
            type="checkbox"
            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            checked={selectedTypes.sms}
            onChange={() => handleToggle("sms")}
          />
          <span className="font-medium text-slate-800 dark:text-slate-200">Send via SMS (Arkesel)</span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
          <input
            type="checkbox"
            className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
            checked={selectedTypes.whatsapp}
            onChange={() => handleToggle("whatsapp")}
          />
          <span className="font-medium text-slate-800 dark:text-slate-200">Send via WhatsApp</span>
        </label>
      </div>
    </Modal>
  );
}
