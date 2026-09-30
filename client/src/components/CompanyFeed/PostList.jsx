/**
 * @fileoverview PostList component.
 * Renders a list of PostCard components.
 */

import React from "react";
import PostCard from "./PostCard";
import ErrorBoundary from "../ErrorBoundary";
import "./PostList.css";

/**
 * PostList component
 * @param {Object} props
 * @param {Array} props.posts - Array of post objects to render.
 * @param {Function} props.setPosts - Function to update posts array.
 * @param {boolean} [props.defaultShowComments=false] - Whether to show comments by default.
 * @param {boolean} [props.forceOpenComments=false] - Whether to force open comments.
 * @returns {JSX.Element}
 */
export default function PostList({
  posts,
  setPosts,
  defaultShowComments = false,
  forceOpenComments = false,
  setModalPostId,
}) {
  return (
    <div className="post-list">
      {posts.map((post) => (
        <div key={post.id}>
          <ErrorBoundary>
            <PostCard
              post={post}
              setPosts={setPosts}
              defaultShowComments={defaultShowComments}
              forceOpenComments={forceOpenComments}
              setModalPostId={setModalPostId}
            />
          </ErrorBoundary>
        </div>
      ))}
    </div>
  );
}
