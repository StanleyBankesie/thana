/**
 * @file CloudinaryDocumentUploader.jsx
 * @description Cloudinary file uploader for ERP documents, drawings, and RFIs.
 * Handles single/multiple uploads with intelligent previous-file detection:
 * asks the user whether to Keep previous files or Discard (delete from Cloudinary)
 * before uploading new files.
 */

import React, { useState, useRef } from "react";
import {
  Cloud,
  Upload,
  Trash2,
  Eye,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Paperclip,
  ExternalLink,
  X,
  Plus
} from "lucide-react";
import { api } from "../../../../api/client.js";
import { toast } from "react-toastify";
import ProjectModal from "./ProjectModal.jsx";

export default function CloudinaryDocumentUploader({
  value = [],
  onChange,
  folder = "omnisuite/construction",
  label = "Documents & Drawings (Cloudinary)",
  description = "Upload PDF, DWG, DXF, DOCX, XLSX, PNG, JPG (Max 50MB)",
  accept = ".pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
  maxFiles = 10,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef(null);

  // Ensure value is always an array of file objects
  const filesList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
    ? [{ url: value, filename: value.split("/").pop() || "Document" }]
    : [];

  // When user picks a file through input
  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    // Clear input so the same file can be re-selected if needed
    e.target.value = "";

    if (filesList.length > 0) {
      // Previous files exist! Open the prompt modal to ask user Keep vs Discard
      setPendingFiles(selected);
      setShowConfirmModal(true);
    } else {
      // First time upload: directly upload to Cloudinary
      performUpload(selected, false);
    }
  };

  /**
   * Uploads files to Cloudinary.
   * If discardOld is true, first deletes previous files from Cloudinary storage.
   */
  const performUpload = async (filesToUpload, discardOld = false) => {
    setUploading(true);
    try {
      if (discardOld && filesList.length > 0) {
        setUploadProgressText("Deleting old files from Cloudinary...");
        try {
          await api.post("/upload/delete", { files: filesList });
          toast.info("Previous files removed from Cloudinary storage");
        } catch (delErr) {
          console.warn("Could not delete some previous files from Cloudinary:", delErr);
        }
      }

      setUploadProgressText("Uploading new file(s) to Cloudinary...");
      const newlyUploaded = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);
        if (folder) formData.append("folder", folder);

        const res = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const data = res.data || {};
        const url = data.url || data.path;
        if (!url) throw new Error(`Upload failed for ${file.name}`);

        newlyUploaded.push({
          url: url,
          filename: data.filename || file.name,
          public_id: data.public_id || null,
          resource_type: data.resource_type || null,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          is_cloudinary: String(url).includes("cloudinary.com"),
        });
      }

      const updatedList = discardOld
        ? newlyUploaded
        : [...filesList, ...newlyUploaded];

      if (onChange) {
        onChange(updatedList);
      }

      toast.success(
        discardOld
          ? "Previous files discarded. New file uploaded to Cloudinary successfully!"
          : `${newlyUploaded.length} file(s) uploaded to Cloudinary successfully!`
      );
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to upload file to Cloudinary");
    } finally {
      setUploading(false);
      setUploadProgressText("");
      setPendingFiles([]);
      setShowConfirmModal(false);
    }
  };

  // User chose: Keep previous files and add the new one
  const handleKeepAndUpload = () => {
    performUpload(pendingFiles, false);
  };

  // User chose: Discard old files, delete them from Cloudinary, then upload new one
  const handleDiscardAndUpload = () => {
    performUpload(pendingFiles, true);
  };

  // Remove individual file from list & Cloudinary
  const handleRemoveSingle = async (indexToRemove) => {
    const fileToRemove = filesList[indexToRemove];
    if (!fileToRemove) return;

    if (!window.confirm(`Delete "${fileToRemove.filename || "file"}" from Cloudinary?`)) {
      return;
    }

    try {
      await api.post("/upload/delete", { files: [fileToRemove] });
      toast.success("File deleted from Cloudinary");
    } catch (err) {
      console.warn("Could not delete file from Cloudinary:", err);
    }

    const updated = filesList.filter((_, idx) => idx !== indexToRemove);
    if (onChange) onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Label and Cloudinary Status Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
          {label}
        </label>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-semibold">
          <Cloud size={12} className="text-sky-500 animate-pulse" />
          <span>Cloudinary Storage</span>
        </div>
      </div>

      {/* Upload Drop Zone / Button */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          uploading
            ? "bg-slate-50 dark:bg-slate-800/40 border-slate-300 cursor-not-allowed"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        {uploading ? (
          <div className="flex flex-col items-center justify-center py-2 space-y-2">
            <Loader2 size={24} className="animate-spin text-brand-600" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {uploadProgressText || "Processing Cloudinary upload..."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
            <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-400 flex items-center justify-center">
              <Upload size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to upload document or drawing
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            </div>
          </div>
        )}
      </div>

      {/* List of currently uploaded files */}
      {filesList.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Uploaded Documents ({filesList.length})
            </span>
            <button
              type="button"
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="text-[11px] text-brand-900 dark:text-brand-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <Plus size={12} /> Add Another File
            </button>
          </div>

          <div className="space-y-1.5">
            {filesList.map((file, index) => {
              const isCloudinary = Boolean(
                file.is_cloudinary || (file.url && file.url.includes("cloudinary.com"))
              );
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isCloudinary
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {isCloudinary ? <Cloud size={16} /> : <FileText size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={file.filename}>
                        {file.filename || "Uploaded Document"}
                      </p>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        {file.size ? `${(file.size / 1024).toFixed(0)} KB • ` : ""}
                        {isCloudinary ? "Cloudinary Cloud" : "Stored File"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary p-1.5 text-slate-600 hover:text-slate-900 dark:hover:text-white"
                      title="View file in new tab"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveSingle(index)}
                      className="btn btn-secondary p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Delete from Cloudinary"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal: Uploading a file for the second time */}
      <ProjectModal
        open={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPendingFiles([]);
        }}
        title="Existing Uploaded Files Detected"
        subtitle="You already have uploaded file(s). Choose whether to keep them or discard them before uploading the new file."
        icon={AlertTriangle}
        maxWidth="max-w-lg"
        showFooter={false}
      >
        <div className="space-y-4 text-xs">
          {/* List of Previous Files */}
          <div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
              Previous / Old Uploaded Files ({filesList.length}):
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
              {filesList.map((oldFile, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Cloud size={14} className="text-sky-500 flex-shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate" title={oldFile.filename}>
                      {oldFile.filename || `File #${i + 1}`}
                    </span>
                  </div>
                  <a
                    href={oldFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-900 dark:text-brand-400 hover:underline flex-shrink-0 flex items-center gap-1 font-semibold"
                  >
                    View <ExternalLink size={10} />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Pending new file */}
          {pendingFiles.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/40">
              <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 block mb-1">
                New File To Upload:
              </span>
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                {pendingFiles.map((f) => f.name).join(", ")}
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                {(pendingFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(0)} KB ready for upload
              </p>
            </div>
          )}

          {/* Question Prompt */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40">
            <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
              How would you like to handle your previous files?
            </p>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
              • <strong>Keep</strong>: Saves the new file in addition to the previous files.
              <br />
              • <strong>Discard</strong>: Deletes the old files from Cloudinary storage before uploading the new file.
            </p>
          </div>

          {/* Action Decision Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowConfirmModal(false);
                setPendingFiles([]);
              }}
              className="btn btn-secondary px-3 py-2 text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDiscardAndUpload}
              className="btn px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 size={13} />
              Discard & Delete Old Files
            </button>

            <button
              type="button"
              onClick={handleKeepAndUpload}
              className="btn btn-primary px-4 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={13} />
              Keep Previous Files
            </button>
          </div>
        </div>
      </ProjectModal>
    </div>
  );
}
