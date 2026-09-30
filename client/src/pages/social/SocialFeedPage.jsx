import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useAuth } from "../../auth/AuthContext";
import api from "../../api/client";

/**
 * SocialFeedPage / Post History Page
 * Displays the historical company and branch posts with search, filter tabs, likers modal, and comment replies.
 */
export default function SocialFeedPage() {
  const navigate = useNavigate();
  const params = useParams();
  const focusId = params?.id ? Number(params.id) : null;
  const { user } = useAuth();

  const userId = Number(user?.sub || user?.id) || null;
  const companyName = user?.companyName || user?.company_name || "Company";
  const branchName = user?.branchName || user?.branch_name || "All Branches";

  const cacheKey = userId ? `omni_post_history_${userId}` : "omni_post_history_default";

  const [posts, setPosts] = useState(() => {
    try {
      const saved = localStorage.getItem(cacheKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "company" | "branch" | "mine"
  const [searchQuery, setSearchQuery] = useState("");
  const [openCommentsPostId, setOpenCommentsPostId] = useState(focusId || null);
  const [commentInputs, setCommentInputs] = useState({});
  const [replyingTo, setReplyingTo] = useState({}); // { [postId]: { commentId, userName } }
  const [submittingComment, setSubmittingComment] = useState({});

  // Likes Modal state
  const [likesModalPost, setLikesModalPost] = useState(null); // post object or null
  const [likesList, setLikesList] = useState([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const commentInputRefs = useRef({});

  // Sync to localStorage
  useEffect(() => {
    if (posts.length > 0 && cacheKey) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(posts));
      } catch {}
    }
  }, [posts, cacheKey]);

  // Fetch posts from backend
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const activeUid = userId || 1;
      const resp = await api.get("/social-feed", {
        params: { limit: 100, offset: 0 },
        headers: { "x-user-id": String(activeUid) },
      });
      const data = resp?.data || {};
      const items = Array.isArray(data.data) ? data.data : [];
      setPosts(items);
      if (cacheKey && items.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(items));
        } catch {}
      }
    } catch (err) {
      console.error("Error loading post history:", err);
      setError(err.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [userId, cacheKey]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Like / Unlike handler with immediate persistence
  const handleToggleLike = async (post) => {
    const isLiked = Boolean(post.user_liked);
    const activeUid = userId || 1;

    // Optimistic UI update & immediate cache sync
    const optimisticPosts = posts.map((p) =>
      p.id === post.id
        ? {
            ...p,
            user_liked: !isLiked,
            like_count: Math.max(0, (Number(p.like_count) || 0) + (isLiked ? -1 : 1)),
          }
        : p
    );
    setPosts(optimisticPosts);
    if (cacheKey) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(optimisticPosts));
      } catch {}
    }

    try {
      let resp;
      if (isLiked) {
        resp = await api.delete(`/social-feed/${post.id}/like`, {
          headers: { "x-user-id": String(activeUid) },
        });
      } else {
        resp = await api.post(`/social-feed/${post.id}/like`, {}, {
          headers: { "x-user-id": String(activeUid) },
        });
      }

      if (resp?.data && resp.data.like_count !== undefined) {
        const confirmedLikes = Number(resp.data.like_count);
        const confirmedUserLiked = resp.data.user_liked !== undefined ? Boolean(resp.data.user_liked) : !isLiked;

        setPosts((prev) => {
          const next = prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  user_liked: confirmedUserLiked,
                  like_count: confirmedLikes,
                }
              : p
          );
          if (cacheKey) {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(next));
            } catch {}
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Error liking post:", err);
      fetchPosts();
    }
  };

  // Open Likers Modal
  const handleOpenLikesModal = async (post) => {
    setLikesModalPost(post);
    setLikesList([]);
    setLoadingLikes(true);
    const activeUid = userId || 1;
    try {
      const resp = await api.get(`/social-feed/${post.id}/likes`, {
        headers: { "x-user-id": String(activeUid) },
      });
      const data = resp?.data?.data || resp?.data || [];
      setLikesList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching likers:", err);
    } finally {
      setLoadingLikes(false);
    }
  };

  // Trigger Reply to a Comment
  const handleStartReply = (postId, comment) => {
    const commenterName = comment.full_name || comment.created_by_name || "User";
    setOpenCommentsPostId(postId);
    setReplyingTo((prev) => ({
      ...prev,
      [postId]: {
        commentId: comment.id,
        userName: commenterName,
      },
    }));

    const currentText = commentInputs[postId] || "";
    const prefix = `@${commenterName} `;
    if (!currentText.startsWith(prefix)) {
      setCommentInputs((prev) => ({
        ...prev,
        [postId]: prefix + currentText,
      }));
    }

    // Focus input
    setTimeout(() => {
      if (commentInputRefs.current[postId]) {
        commentInputRefs.current[postId].focus();
      }
    }, 100);
  };

  // Cancel Reply
  const handleCancelReply = (postId) => {
    setReplyingTo((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  };

  // Add Comment handler
  const handleAddComment = async (postId, e) => {
    e.preventDefault();
    const commentText = (commentInputs[postId] || "").trim();
    if (!commentText) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    const activeUid = userId || 1;

    try {
      const resp = await api.post(
        `/social-feed/${postId}/comments`,
        { comment_text: commentText },
        { headers: { "x-user-id": String(activeUid) } }
      );

      const newComment = resp?.data?.data || {
        id: Date.now(),
        user_id: activeUid,
        full_name: user?.full_name || user?.username || "You",
        comment_text: commentText,
        created_at: new Date().toISOString(),
        profile_picture_url: user?.profile_picture_url || "/default-avatar.png",
      };

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comment_count: (p.comment_count || 0) + 1,
                comments: [...(p.comments || []), newComment],
              }
            : p
        )
      );

      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
      handleCancelReply(postId);
    } catch (err) {
      console.error("Error adding comment:", err);
      alert("Failed to submit comment. Please try again.");
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Helper to format date safely
  const formatTime = (timeStr) => {
    if (!timeStr) return "Just now";
    try {
      const d = typeof timeStr === "string" ? parseISO(timeStr) : new Date(timeStr);
      if (isNaN(d.getTime())) return "Recently";
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  // Render formatted comment text highlighting @mentions
  const renderCommentText = (text) => {
    if (!text) return "";
    const mentionRegex = /^(@[^\s:]+)\s*(.*)/s;
    const match = text.match(mentionRegex);
    if (match) {
      const mention = match[1];
      const rest = match[2];
      return (
        <span>
          <span className="inline-block px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700 font-semibold text-[11px] mr-1.5">
            {mention}
          </span>
          {rest}
        </span>
      );
    }
    return text;
  };

  // Filter posts based on active tab and search query
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      // Tab filter
      if (activeTab === "company" && p.visibility_type !== "company") return false;
      if (activeTab === "branch" && !["branch", "warehouse"].includes(p.visibility_type)) return false;
      if (activeTab === "mine" && Number(p.user_id) !== userId) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const contentMatch = (p.content || "").toLowerCase().includes(query);
        const authorMatch = (p.full_name || "").toLowerCase().includes(query);
        return contentMatch || authorMatch;
      }

      return true;
    });
  }, [posts, activeTab, searchQuery, userId]);

  const counts = useMemo(() => {
    return {
      all: posts.length,
      company: posts.filter((p) => p.visibility_type === "company").length,
      branch: posts.filter((p) => ["branch", "warehouse"].includes(p.visibility_type)).length,
      mine: posts.filter((p) => Number(p.user_id) === userId).length,
    };
  }, [posts, userId]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📜</span>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Post History
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing historical posts for <span className="font-semibold text-slate-700 dark:text-slate-300">{companyName}</span> ({branchName})
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPosts}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Refresh Feed"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              Refresh
            </button>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-brand text-white hover:bg-brand-700 shadow-sm transition"
            >
              ← Home
            </button>
          </div>
        </div>

        {/* Search and Tabs */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "all"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              All Posts ({counts.all})
            </button>
            <button
              onClick={() => setActiveTab("company")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "company"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              🌍 Company ({counts.company})
            </button>
            <button
              onClick={() => setActiveTab("branch")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "branch"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              🏬 Branch ({counts.branch})
            </button>
            <button
              onClick={() => setActiveTab("mine")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "mine"
                  ? "bg-brand text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              👤 My Posts ({counts.mine})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search posts or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="absolute left-3 top-2 text-xs text-slate-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Empty State */}
      {filteredPosts.length === 0 && !loading && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            No posts found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No posts matched "${searchQuery}". Try clearing your search.`
              : "No historical posts were found for your current company/branch selection."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200"
            >
              Clear Search
            </button>
          )}
        </div>
      )}

      {/* Post List */}
      <div className="space-y-4">
        {filteredPosts.map((post) => {
          const isCommentsOpen = openCommentsPostId === post.id;
          const commentsList = post.comments || [];
          const currentReplying = replyingTo[post.id];

          return (
            <article
              key={post.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition duration-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.profile_picture_url || "/default-avatar.png"}
                      alt={post.full_name || "Author"}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-avatar.png";
                      }}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {post.full_name || "OmniSuite User"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatTime(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      post.visibility_type === "company"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                    }`}
                  >
                    {post.visibility_type === "company" ? "🌍 Company" : "🏬 Branch"}
                  </span>
                </div>

                {/* Card Content */}
                <div className="mt-3.5">
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Optional Image */}
                {post.image_url && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-[420px] bg-slate-950 flex items-center justify-center">
                    <img
                      src={post.image_url}
                      alt="Post Attachment"
                      className="w-full h-auto max-h-[420px] object-contain"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>

              {/* Stats Bar with Prominent Badges */}
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* High visibility clickable Likes badge */}
                  <button
                    type="button"
                    onClick={() => handleOpenLikesModal(post)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800 transition cursor-pointer shadow-2xs"
                    title="Click to view users who liked this post"
                  >
                    <span>👍</span>
                    <span>{post.like_count || 0} {post.like_count === 1 ? "Like" : "Likes"}</span>
                    <span className="text-[10px] text-blue-500 font-normal ml-0.5">• View</span>
                  </button>

                  {/* High visibility Comments badge */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCommentsPostId(isCommentsOpen ? null : post.id)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span>💬</span>
                    <span>{post.comment_count || 0} {post.comment_count === 1 ? "Comment" : "Comments"}</span>
                  </button>
                </div>

                <span className="text-[11px] font-medium text-slate-400">
                  Post #{post.id}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleLike(post)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
                    post.user_liked
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  <span>{post.user_liked ? "❤️" : "👍"}</span>
                  <span>{post.user_liked ? "Liked" : "Like"} ({post.like_count || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setOpenCommentsPostId(isCommentsOpen ? null : post.id)
                  }
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition ${
                    isCommentsOpen
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  <span>💬</span>
                  <span>{isCommentsOpen ? "Hide Comments" : "Comments"} ({post.comment_count || 0})</span>
                </button>
              </div>

              {/* Comments Section */}
              {isCommentsOpen && (
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                  {/* Comments List */}
                  {commentsList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">
                      No comments yet. Write the first one!
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {commentsList.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 shadow-sm group"
                        >
                          <img
                            src={c.profile_picture_url || "/default-avatar.png"}
                            alt={c.full_name || "User"}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/default-avatar.png";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {c.full_name || c.created_by_name || "User"}
                              </h5>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {formatTime(c.created_at)}
                                </span>
                                {/* Reply button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartReply(post.id, c)}
                                  className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-0.5"
                                  title={`Reply to ${c.full_name || "user"}`}
                                >
                                  <span>↩️</span> Reply
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                              {renderCommentText(c.comment_text)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Active Reply Banner */}
                  {currentReplying && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-xs text-brand-800 dark:text-brand-300">
                      <span>Replying to <span className="font-bold">{currentReplying.userName}</span></span>
                      <button
                        type="button"
                        onClick={() => handleCancelReply(post.id)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  )}

                  {/* Comment Input */}
                  <form
                    onSubmit={(e) => handleAddComment(post.id, e)}
                    className="flex items-center gap-2 pt-1"
                  >
                    <input
                      ref={(el) => (commentInputRefs.current[post.id] = el)}
                      type="text"
                      placeholder={
                        currentReplying
                          ? `Reply to @${currentReplying.userName}...`
                          : "Write a comment..."
                      }
                      value={commentInputs[post.id] || ""}
                      onChange={(e) =>
                        setCommentInputs((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      className="flex-1 px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    <button
                      type="submit"
                      disabled={
                        submittingComment[post.id] ||
                        !(commentInputs[post.id] || "").trim()
                      }
                      className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold hover:bg-brand-700 disabled:opacity-50 transition shadow-sm"
                    >
                      {submittingComment[post.id] ? "..." : "Send"}
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Likers Modal */}
      {likesModalPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setLikesModalPost(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👍</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Users who liked this post
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLikesModalPost(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 max-h-80 overflow-y-auto space-y-3">
              {loadingLikes ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <span className="inline-block animate-spin mr-2">🔄</span> Loading likers...
                </div>
              ) : likesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No likes found for this post yet.
                </div>
              ) : (
                likesList.map((liker, idx) => (
                  <div
                    key={liker.user_id || idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={liker.profile_picture_url || "/default-avatar.png"}
                        alt={liker.full_name || "User"}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-avatar.png";
                        }}
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                          {liker.full_name || liker.username || "User"}
                        </h4>
                        {liker.username && (
                          <p className="text-[10px] text-slate-400">
                            @{liker.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] text-slate-400">
                      {formatTime(liker.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-right">
              <button
                type="button"
                onClick={() => setLikesModalPost(null)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


