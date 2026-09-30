/**
 * @fileoverview DocumentAttachmentsModal component.
 * Modal for viewing, adding, and removing attachments for documents.
 */

import React, { useEffect, useState, useRef } from "react";
import { api } from "api/client";
import { toast } from "react-toastify";

/**
 * DocumentAttachmentsModal component
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open.
 * @param {Function} props.onClose - Callback to close the modal.
 * @param {string} props.docType - The document type.
 * @param {number|string} props.docId - The document ID.
 * @param {boolean} [props.allowPreview=true] - Whether to allow file previews.
 * @param {boolean} [props.readOnly=false] - Whether the modal is in read-only mode.
 * @returns {JSX.Element|null}
 */
export default function DocumentAttachmentsModal({
  open,
  onClose,
  docType,
  docId,
  allowPreview = true,
  readOnly = false,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [pendingList, setPendingList] = useState([]); // [{file, preview, meta}]
  const apiOriginRef = useRef("");
  /**
   * Builds the full URL for an attachment.
   * @param {string} s - The relative or absolute path.
   * @returns {string} The formatted URL.
   */
  const buildHref = (s) => {
    const file = String(s || "");
    if (/^https?:\/\//i.test(file)) return file;
    if (!file.startsWith("/uploads") && !file.startsWith("uploads")) return file;
    const uploadsPath = file.startsWith("/uploads") ? file : `/${file}`;
    const base = String(api.defaults.baseURL || "");
    if (/^https?:\/\//i.test(base)) {
      try {
        const u = new URL(base);
        return `${u.protocol}//${u.host}${uploadsPath}`;
      } catch {
        return uploadsPath;
      }
    }
    // Fallback to API-prefixed path so dev proxy forwards to backend
    return `/api${uploadsPath}`;
  };
  /**
   * Formats a byte size into a human-readable string.
   * @param {number} b - Size in bytes.
   * @returns {string} Formatted string.
   */
  const formatBytes = (b) => {
    const n = Number(b);
    if (!Number.isFinite(n) || n < 0) return "";
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i++;
    }
    const d = v < 10 && i > 0 ? 1 : 0;
    return `${v.toFixed(d)} ${u[i]}`;
  };
  // Strict preview: use the exact file_url returned by the server without rewriting

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!open || !docType || !docId) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/documents/${docType}/${docId}/attachments`);
        try {
          const base = String(api.defaults.baseURL || "");
          if (/^https?:\/\//i.test(base)) {
            const u = new URL(base);
            apiOriginRef.current = `${u.protocol}//${u.host}`;
          } else {
            apiOriginRef.current =
              typeof window !== "undefined" && window.location
                ? window.location.origin
                : "";
          }
        } catch {}
        const arr = Array.isArray(res?.data?.items) ? res.data.items : [];
        if (mounted) setItems(arr);
      } catch (e) {
        if (mounted)
          setError(e?.response?.data?.message || "Failed to load attachments");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [open, docType, docId]);

  /**
   * Handles file selection from the input.
   * @param {Event} e - The change event.
   */
  function onPickFile(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next = files.map((file) => {
      let preview = null;
      if (
        (file.type || "").startsWith("image/") ||
        (file.type || "").startsWith("video/")
      ) {
        try {
          preview = URL.createObjectURL(file);
        } catch {}
      }
      return {
        file,
        preview,
        meta: {
          title: file.name,
          category: "",
          description: "",
          tags: "",
        },
      };
    });
    setPendingList((prev) => prev.concat(next));
    setError("");
  }

  /**
   * Saves all pending attachments to the server.
   */
  async function onSaveAttachment() {
    if (!pendingList.length) {
      setError("Please choose at least one file");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const p of pendingList) {
        const fd = new FormData();
        fd.append("file", p.file);
        const up = await api.post(`/upload`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url =
          up?.data?.url || up?.data?.data?.url || up?.data?.path || null;
        if (!url) throw new Error("Upload failed");
        const m = p.meta || {};
        await api.post(`/documents/${docType}/${docId}/attachments`, {
          url,
          name: p.file.name,
          title: m.title || p.file.name,
          description: m.description || null,
          category: m.category || null,
          tags: m.tags || null,
          mime_type: p.file.type || null,
          file_size: p.file.size || null,
        });
      }
      // Refresh list
      const res = await api.get(`/documents/${docType}/${docId}/attachments`);
      const arr = Array.isArray(res?.data?.items) ? res.data.items : [];
      setItems(arr);
      // Cleanup and notify
      if (fileRef.current) fileRef.current.value = "";
      try {
        for (const p of pendingList) {
          if (p.preview && String(p.preview).startsWith("blob:")) {
            URL.revokeObjectURL(p.preview);
          }
        }
      } catch {}
      setPendingList([]);
      try {
        toast.success("Attachments saved");
      } catch {}
      // Close the window after success (no additional modals)
      if (typeof onClose === "function") onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /**
   * Removes an attachment by ID.
   * @param {number|string} id - The attachment ID.
   */
  async function onRemove(id) {
    try {
      await api.delete(`/documents/${docType}/${docId}/attachments/${id}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch {}
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-[720px] max-w-[95%]">
        <div className="p-4 border-b flex justify-between items-center bg-brand text-white rounded-t-lg">
          <div className="font-semibold">Attachments</div>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <div className="space-y-3">
            {!readOnly ? (
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={onPickFile}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-sm">Uploading...</span>
                ) : null}
              </div>
            ) : null}
            {!readOnly && pendingList.length > 0 ? (
              <div className="space-y-4">
                {pendingList.map((p, idx) => (
                  <div
                    key={`${p.file.name}-${p.file.size}-${idx}`}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start"
                  >
                    <div className="border rounded p-2">
                      {p.preview && (p.file.type || "").startsWith("image/") ? (
                        <img
                          src={p.preview}
                          alt={p.file.name}
                          className="w-full h-48 object-contain"
                        />
                      ) : p.preview &&
                        (p.file.type || "").startsWith("video/") ? (
                        <video
                          src={p.preview}
                          className="w-full h-48 object-contain"
                          controls
                        />
                      ) : (
                        <div className="text-sm">
                          {p.file.name} ({p.file.type || "file"})
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Title"
                        value={p.meta.title}
                        onChange={(e) =>
                          setPendingList((list) =>
                            list.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    meta: { ...x.meta, title: e.target.value },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Category"
                        value={p.meta.category}
                        onChange={(e) =>
                          setPendingList((list) =>
                            list.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    meta: {
                                      ...x.meta,
                                      category: e.target.value,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="Tags (comma separated)"
                        value={p.meta.tags}
                        onChange={(e) =>
                          setPendingList((list) =>
                            list.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    meta: { ...x.meta, tags: e.target.value },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <textarea
                        className="input w-full"
                        placeholder="Description"
                        rows={3}
                        value={p.meta.description}
                        onChange={(e) =>
                          setPendingList((list) =>
                            list.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    meta: {
                                      ...x.meta,
                                      description: e.target.value,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            try {
                              if (
                                p.preview &&
                                String(p.preview).startsWith("blob:")
                              ) {
                                URL.revokeObjectURL(p.preview);
                              }
                            } catch {}
                            setPendingList((list) =>
                              list.filter((_, i) => i !== idx),
                            );
                          }}
                          disabled={uploading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-success"
                    onClick={onSaveAttachment}
                    disabled={uploading}
                  >
                    Save {pendingList.length} Attachment
                    {pendingList.length > 1 ? "s" : ""}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      try {
                        for (const p of pendingList) {
                          if (
                            p.preview &&
                            String(p.preview).startsWith("blob:")
                          ) {
                            URL.revokeObjectURL(p.preview);
                          }
                        }
                      } catch {}
                      setPendingList([]);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div>
            {loading ? (
              <div className="text-sm">Loading attachments...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-slate-500">No attachments yet</div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((a) => {
                const href = buildHref(a.file_url);
                const isImg =
                  String(a.mime_type || "").startsWith("image/") ||
                  /\.(png|jpe?g|webp|gif)$/i.test(
                    String(a.file_name || a.file_url || ""),
                  );
                const isVideo = String(a.mime_type || "").startsWith("video/");
                const showFileNameLine = isImg || isVideo;
                return (
                  <div
                    key={a.id}
                    className="border rounded p-3 flex flex-col items-stretch gap-2"
                  >
                    {allowPreview ? (
                      isImg ? (
                        <img
                          src={href}
                          alt={a.file_name || "attachment"}
                          className="w-full h-40 object-contain"
                        />
                      ) : isVideo ? (
                        <video
                          src={href}
                          className="w-full h-40 object-contain"
                          controls
                        />
                      ) : (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-brand truncate"
                        >
                          {a.file_name || "Download"}
                        </a>
                      )
                    ) : (
                      <div className="text-sm text-slate-700 truncate">
                        {a.file_name || "Attachment"}
                      </div>
                    )}
                    <div className="text-xs text-center space-y-1">
                      {a.title || a.category ? (
                        <div className="space-y-0.5">
                          {a.title ? <div className="font-medium">{a.title}</div> : null}
                          {a.category ? <div className="text-slate-500">{a.category}</div> : null}
                          {a.description ? (
                            <div className="text-[11px] text-slate-500 line-clamp-2">
                              {a.description}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {showFileNameLine ? (
                        <div className="text-[11px] text-slate-600 truncate">
                          {a.file_name || ""}
                        </div>
                      ) : null}
                      <div className="text-[11px] text-slate-500">
                        {(a.mime_type || "") || ""}
                        {a.file_size ? ` · ${formatBytes(a.file_size)}` : ""}
                        {a.created_at ? ` · ${new Date(a.created_at).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100">
                      {allowPreview ? (
                        <>
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline w-full sm:w-auto"
                          >
                            Open
                          </a>
                          <a
                            href={href}
                            download={a.file_name || true}
                            className="btn btn-sm w-full sm:w-auto"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download
                          </a>
                        </>
                      ) : (
                        <a
                          href={href}
                          download={a.file_name || true}
                          className="btn btn-sm w-full sm:w-auto"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      )}
                      {!readOnly ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-error w-full sm:w-auto"
                          onClick={() => onRemove(a.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
