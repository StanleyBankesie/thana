/**
 * @fileoverview SocialFeedNotification component.
 * Displays real-time notifications for new posts and comments.
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../../hooks/useSocket";
import { useAuth } from "../../auth/AuthContext";
import "./SocialFeedNotification.css";

/**
 * SocialFeedNotification component
 * @returns {JSX.Element}
 */
export default function SocialFeedNotification() {
  const [unreadItems, setUnreadItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const socket = useSocket();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Socket.io listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    // Listen for new posts
    socket.on("new_post", (newPost) => {
      const currentUserId = Number(user?.sub || user?.id);
      if (Number(newPost.user_id) === currentUserId) return;
      
      setUnreadItems((prev) => [
        ...prev,
        {
          id: `post_${newPost.id}`,
          type: "post",
          postId: newPost.id,
          post: newPost,
          timestamp: new Date(),
        },
      ]);
      // Trigger browser push notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`${newPost.full_name} posted`, {
          body: newPost.content.substring(0, 100),
          icon: newPost.profile_picture_url || "/default-avatar.png",
        });
      }
    });

    // Listen for comments
    socket.on("post_commented", (data) => {
      setUnreadItems((prev) => [
        ...prev,
        {
          id: `comment_${data.comment.id}`,
          type: "comment",
          postId: data.postId,
          comment: data.comment,
          timestamp: new Date(),
        },
      ]);
      // Trigger browser push notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`${data.comment.full_name} commented`, {
          body: data.comment.comment_text.substring(0, 100),
          icon: data.comment.profile_picture_url || " ",
        });
      }
    });

    return () => {
      socket.off("new_post");
      socket.off("post_commented");
    };
  }, [socket, user]);

  /**
   * Handles clicking on the notification badge.
   */
  const handleBadgeClick = () => {
    setShowModal(true);
  };

  /**
   * Handles clicking on a specific notification item.
   * @param {Object} item - The clicked notification item.
   */
  const handleItemClick = (item) => {
    setShowModal(false);
    setUnreadItems((prev) => prev.filter((i) => i.postId !== item.postId));
    navigate(`/social-feed/${item.postId}`);
  };

  return (
    <>
      {/* Floating Badge */}
      {unreadItems.length > 0 && (
        <button
          onClick={handleBadgeClick}
          className="social-feed-notification-badge"
          title={`${unreadItems.length} unread item${unreadItems.length !== 1 ? "s" : ""}`}
        >
          <div className="badge-pulse"></div>
          <div className="badge-content">
            {unreadItems.length > 99 ? "99+" : unreadItems.length}
          </div>
        </button>
      )}

      {/* Unread Messages Modal */}
      {showModal && (
        <div className="social-feed-notification-overlay">
          <div className="social-feed-notification-modal">
            <div className="modal-header">
              <h3>Unread Activity ({unreadItems.length})</h3>
              <button
                onClick={() => setShowModal(false)}
                className="close-button"
              >
                ✕
              </button>
            </div>

            <div className="modal-list">
              {unreadItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="modal-item"
                >
                  {item.type === "post" ? (
                    <div>
                      <p className="item-user">{item.post.full_name}</p>
                      <p className="item-content">{item.post.content}</p>
                      <p className="item-type">New Post</p>
                    </div>
                  ) : (
                    <div>
                      <p className="item-user">{item.comment.full_name}</p>
                      <p className="item-content">
                        {item.comment.comment_text}
                      </p>
                      <p className="item-type">New Comment</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
