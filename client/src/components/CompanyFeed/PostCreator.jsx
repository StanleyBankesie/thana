/**
 * @fileoverview PostCreator component.
 * Provides a form to create new posts in the social feed.
 */

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../../auth/AuthContext";
import "./PostCreator.css";
import { toast } from "react-toastify";
import api from "../../api/client";

/**
 * PostCreator component
 * @param {Object} props
 * @param {Function} props.onPostCreated - Callback when a post is successfully created.
 * @returns {JSX.Element}
 */
export default function PostCreator({ onPostCreated }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [visibilityType, setVisibilityType] = useState("company");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userProfilePic, setUserProfilePic] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch user profile picture from adm_users table
  useEffect(() => {
    if (!user?.id && !user?.sub) return;
    const fetchUserProfile = async () => {
      try {
        const resMe = await api.get(`/admin/me`);
        if (resMe?.status === 200) {
          const ctx = resMe.data?.data || resMe.data || null;
          const url =
            ctx?.user?.profile_picture_url || ctx?.profile_picture_url || null;
          if (url) {
            setUserProfilePic(url);
            return;
          }
        }
        setUserProfilePic("/default-avatar.png");
      } catch {
        setUserProfilePic("/default-avatar.png");
      }
    };
    fetchUserProfile();
  }, [user?.id, user?.sub]);

  /**
   * Handles image file selection.
   * @param {Event} e - The input change event.
   */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type and size
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed");
      return;
    }

    if (file.size > maxSize) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Local preview immediately
    try {
      const localUrl = URL.createObjectURL(file);
      setPreviewUrl(localUrl);
    } catch {}

    // Upload image
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    api
      .post(`/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => {
        const payload = res?.data || {};
        const url =
          payload?.url ||
          payload?.data?.url ||
          payload?.path || // fallback relative path
          null;
        if (!url) {
          setError("Upload failed");
          return;
        }
        setImageUrl(url);
        if (typeof url === "string" && /^(data:|https?:)/i.test(url)) {
          setPreviewUrl(url);
        }
        setError(null);
      })
      .catch((err) => {
        setError("Upload error: " + err.message);
      })
      .finally(() => setLoading(false));
  };

  // Revoke object URL when preview changes or on cleanup
  useEffect(() => {
    return () => {
      try {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch {}
    };
  }, [previewUrl]);

  /**
   * Handles submitting the new post.
   * @param {Event} e - The form submit event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("Please enter some content");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const uid = Number(user?.sub || user?.id) || "";
      // Step 1: Create post quickly (without waiting for image upload)
      const response = await api.post(
        `/social-feed`,
        {
          content,
          image_url: null,
          visibility_type: visibilityType,
        },
        { headers: { "x-user-id": String(uid) } },
      );
      const data = response?.data || {};
      const created = data.data;
      onPostCreated(created);
      try {
        toast.success("Post created");
      } catch {}

      // Step 2: Finalize image (Cloudinary) and record attachment
      try {
        let url = imageUrl || null;
        let fileName = null;
        let mimeType = null;
        let fileSize = null;
        const file = fileInputRef.current?.files?.[0] || null;
        if (!url && file) {
          const formData = new FormData();
          formData.append("file", file);
          const up = await api.post(`/upload`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          url = up?.data?.url || up?.data?.data?.url || up?.data?.path || null;
          fileName = up?.data?.file_name || file.name;
          mimeType = file.type || null;
          fileSize = file.size || null;
        } else if (file) {
          fileName = file.name;
          mimeType = file.type || null;
          fileSize = file.size || null;
        }
        if (url && created?.id) {
          await api.put(`/social-feed/${created.id}/image`, {
            image_url: url,
          }, { headers: { "x-user-id": String(uid) } });
          // Save into attachments table for traceability
          try {
            await api.post(`/documents/social-post/${created.id}/attachments`, {
              url,
              name: fileName || "image",
              title: fileName || "image",
              mime_type: mimeType || null,
              file_size: fileSize || null,
            });
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("omni.social.postImageUpdated", {
                detail: { postId: created.id, image_url: url },
              }),
            );
          } catch {}
        }
      } catch {}

      // Reset form quickly so the UI feels instant
      setContent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImageUrl(null);
      try {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch {}
      setPreviewUrl(null);
      setVisibilityType("company");
      setError(null);
    } catch (err) {
      console.error("Error creating post:", err);
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-creator-card">
      <div className="post-creator-header">
        <img
          src={userProfilePic || "/default-avatar.png"}
          alt={user?.name || user?.username || "User"}
          className="avatar"
        />
        <form onSubmit={handleSubmit} className="post-form">
          <textarea
            className="post-input"
            placeholder="Start chat"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="3"
          />

          {imageUrl && (
            <div className="image-preview">
              <img src={previewUrl || imageUrl} alt="Preview" />
              <button
                type="button"
                onClick={() => {
                  setImageUrl(null);
                  try {
                    if (previewUrl && previewUrl.startsWith("blob:")) {
                      URL.revokeObjectURL(previewUrl);
                    }
                  } catch {}
                  setPreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="btn-remove-image"
              >
                ✕
              </button>
            </div>
          )}

          <div className="post-actions">
            <div className="left-actions">
              <button
                type="button"
                className="btn-icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                📷 Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />

              <select
                value={visibilityType}
                onChange={(e) => setVisibilityType(e.target.value)}
                className="visibility-select"
              >
                <option value="company">🌍 Company</option>
                <option value="branch">🏬 My Branch</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn-post"
              disabled={loading || !content.trim()}
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
        </form>
      </div>

      {/* Selected users visibility removed */}
    </div>
  );
}
