/**
 * @fileoverview CompanyFeed component.
 * Displays a social feed for the company with posts and comments.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import PostCreator from "./PostCreator";
import PostList from "./PostList";
import { useSocket } from "../../hooks/useSocket";
import "./CompanyFeed.css";
import api from "../../api/client";

/**
 * CompanyFeed component
 * Renders the social feed page.
 * @param {Object} props
 * @param {boolean} [props.compact=false] - Whether to render in compact mode.
 * @param {number|null} [props.focusId=null] - ID of a specific post to focus on.
 * @param {boolean} [props.hideCreator=false] - Whether to hide the post creator form.
 * @returns {JSX.Element}
 */
export default function CompanyFeed({
  compact = false,
  focusId = null,
  hideCreator = false,
}) {
  const { user } = useAuth();
  const socket = useSocket();

  const userId = Number(user?.sub || user?.id) || null;
  // Per-user cache key so different users never share cached posts
  const cacheKey = userId ? `omni_social_feed_posts_${userId}` : null;

  const [posts, setPosts] = useState(() => {
    if (Number.isFinite(focusId) && focusId > 0) return [];
    try {
      // Try to load cached posts for the current user immediately on mount
      // Even before auth context resolves, we can read userId from stored auth
      const storedAuth = JSON.parse(localStorage.getItem("omnisuite.auth") || "null");
      const storedUserId = Number(storedAuth?.user?.sub || storedAuth?.user?.id || storedAuth?.id) || null;
      const key = storedUserId ? `omni_social_feed_posts_${storedUserId}` : null;
      if (!key) return [];
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [modalPostId, setModalPostId] = useState(null);
  const navigate = useNavigate();
  const [forceOpenComments, setForceOpenComments] = useState(false);
  const autoLoadedRef = useRef(false);

  // Persist posts to localStorage under per-user key on change
  useEffect(() => {
    if (cacheKey && !(Number.isFinite(focusId) && focusId > 0) && posts.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(posts));
      } catch {}
    }
  }, [posts, focusId, cacheKey]);

  /**
   * Fetches posts from the server.
   * @param {number} [pageOffset=0] - The offset for pagination.
   */
  const fetchPosts = useCallback(
    async (pageOffset = 0) => {
      if (!userId) return;

      try {
        setLoading(true);
        const isFocus = Number.isFinite(focusId) && focusId > 0;
        const url = isFocus ? `/social-feed/${focusId}` : `/social-feed`;
        const resp = await api.get(url, {
          params: isFocus ? {} : { offset: pageOffset, limit: 15 },
          headers: { "x-user-id": String(userId) },
        });
        const data = resp?.data || {};
        if (isFocus) {
          const post = data?.data ? data.data : null;
          if (post) setPosts([post]);
        } else {
          const items = Array.isArray(data.data) ? data.data : [];
          if (pageOffset === 0) {
            // Only replace posts if server actually returned data.
            // If empty, keep any cached posts visible (don't wipe them).
            if (items.length > 0) {
              setPosts(items);
            }
          } else {
            setPosts((prev) => {
              const seen = new Set(prev.map((p) => p.id));
              return [...prev, ...items.filter((p) => !seen.has(p.id))];
            });
          }
        }
        setOffset(pageOffset);
      } catch (err) {
        console.error("Error fetching posts:", err);
        // On error, don't wipe existing posts
      } finally {
        setLoading(false);
      }
    },
    [userId, focusId],
  );

  // Fetch fresh posts whenever userId changes (not on every fetchPosts identity change)
  useEffect(() => {
    if (userId) fetchPosts(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, focusId]);

  // Socket.io listeners for real-time updates (likes only)
  useEffect(() => {
    if (!socket) return;

    // Listen for likes
    socket.on("post_liked", (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.postId
            ? { ...post, like_count: post.like_count + 1 }
            : post,
        ),
      );
    });

    socket.on("post_unliked", (data) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === data.postId
            ? { ...post, like_count: Math.max(0, post.like_count - 1) }
            : post,
        ),
      );
    });

    return () => {
      socket.off("post_liked");
      socket.off("post_unliked");
    };
  }, [socket]);

  /**
   * Handles successful creation of a new post.
   * @param {Object} newPost - The newly created post object.
   */
  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  /**
   * Loads more posts or comments.
   */
  const handleLoadMore = async () => {
    const isFocus = Number.isFinite(focusId) && focusId > 0;
    if (isFocus) {
      try {
        const current = posts[0];
        if (!current) return;
        const already = Array.isArray(current.comments)
          ? current.comments.length
          : 0;
        const total = Number(current.comment_count || already);
        const remaining = Math.max(total - already, 0);
        setLoading(true);
        const uid = Number(user?.sub || user?.id) || "";
        const res = await api.get(`/social-feed/${focusId}/comments`, {
          params: { offset: already, limit: remaining || 20 },
          headers: { "x-user-id": String(uid) },
        });
        const data = res?.data || {};
        const more = Array.isArray(data.data) ? data.data : [];
        setPosts((prev) => {
          if (!prev.length) return prev;
          const p = prev[0];
          const seen = new Set((p.comments || []).map((c) => c.id));
          const merged = [
            ...(p.comments || []),
            ...more.filter((c) => !seen.has(c.id)),
          ];
          const np = { ...p, comments: merged, comment_count: p.comment_count };
          return [np, ...prev.slice(1)];
        });
        setForceOpenComments(true);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    fetchPosts(offset + 10);
  };

  // Listen for post image updates (background upload completion)
  useEffect(() => {
    function onPostImageUpdated(e) {
      const detail = e?.detail || {};
      const id = Number(detail.postId || detail.id);
      const image_url = detail.image_url || null;
      if (!Number.isFinite(id) || !image_url) return;
      setPosts((prev) =>
        prev.map((p) => (Number(p.id) === id ? { ...p, image_url } : p)),
      );
    }
    window.addEventListener("omni.social.postImageUpdated", onPostImageUpdated);
    return () =>
      window.removeEventListener(
        "omni.social.postImageUpdated",
        onPostImageUpdated,
      );
  }, []);

  const handleLoadLess = () => {
    if (offset === 0) return;
    const newOffset = Math.max(0, offset - 10);
    setPosts(prev => prev.slice(0, newOffset || 10)); // keep at least the first page
    setOffset(newOffset);
  };

  if (!user) {
    return (
      <div className="company-feed-container">
        <p>Please log in to view the company feed.</p>
      </div>
    );
  }

  // For compact mode, show PostCreator only (badge now separate)
  if (compact && !(Number.isFinite(focusId) && focusId > 0)) {
    return (
      <div className="company-feed-container">
        <PostCreator onPostCreated={handlePostCreated} />
      </div>
    );
  }

  // Full post history view
  return (
    <div className="company-feed-container">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Post History
        </h2>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      {!hideCreator && !(Number.isFinite(focusId) && focusId > 0) && (
        <PostCreator onPostCreated={handlePostCreated} />
      )}

      {error ? (
        <div className="error-state text-red-500 p-4 border border-red-200 rounded-xl mb-4 bg-red-50">
          <p>Error: {error}</p>
        </div>
      ) : loading && posts.length === 0 ? (
        <div className="loading-spinner">Loading posts...</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <p>No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <>
          <PostList
            posts={posts}
            setPosts={setPosts}
            defaultShowComments={Number.isFinite(focusId) && focusId > 0}
            forceOpenComments={forceOpenComments}
            setModalPostId={setModalPostId}
          />
          <div className="flex gap-4 mx-auto mt-5" style={{ width: "75%" }}>
            <button
              className="btn-load-more"
              style={{ flex: 1 }}
              onClick={handleLoadLess}
              disabled={loading || offset === 0}
            >
              Load Less
            </button>
            <button
              className="btn-load-more"
              style={{ flex: 1 }}
              onClick={handleLoadMore}
              disabled={
                loading ||
                (Number.isFinite(focusId) &&
                  focusId > 0 &&
                  (posts[0]?.comment_count ?? 0) > 0 &&
                  (posts[0]?.comments?.length ?? 0) >=
                    (posts[0]?.comment_count ?? 0))
              }
            >
              {loading
                ? "Loading..."
                : Number.isFinite(focusId) &&
                    focusId > 0 &&
                    (posts[0]?.comment_count ?? 0) > 0 &&
                    (posts[0]?.comments?.length ?? 0) >=
                      (posts[0]?.comment_count ?? 0)
                  ? "All comments loaded"
                  : "Load More"}
            </button>
          </div>
        </>
      )}

      {modalPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setModalPostId(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center z-10"
            >
              ✕
            </button>
            <div className="p-6 pt-10">
              <CompanyFeed focusId={modalPostId} hideCreator compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
