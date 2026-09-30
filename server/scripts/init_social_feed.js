#!/usr/bin/env node

/**
 * Initialize Social Feed Database Schema
 * Run: node scripts/init_social_feed.js
 */

import { pool } from "../db/pool.js";

async function initSocialFeedSchema() {
  const connection = await pool.getConnection();

  try {
    console.log("🔄 Creating social feed schema...");

    // 1️⃣ POSTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content LONGTEXT NOT NULL,
        image_url VARCHAR(500),
        visibility_type ENUM('company', 'warehouse') NOT NULL DEFAULT 'company',
        warehouse_id INT,
        like_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_posts_visibility (visibility_type),
        INDEX idx_posts_warehouse (warehouse_id),
        INDEX idx_posts_user (user_id),
        INDEX idx_posts_created_at (created_at DESC)
      )
    `);
    console.log("✅ posts table created");

    // 2️⃣ POST_LIKES TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_post_like (post_id, user_id),
        INDEX idx_likes_post (post_id),
        INDEX idx_likes_user (user_id)
      )
    `);
    console.log("✅ post_likes table created");

    // 3️⃣ POST_COMMENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comments_post (post_id),
        INDEX idx_comments_user (user_id),
        INDEX idx_comments_created (created_at DESC)
      )
    `);
    console.log("✅ post_comments table created");

    console.log("\n✅ Social Feed Schema initialized successfully!");
    console.log("\nYou can now use the following API endpoints:");
    console.log(
      "  GET    /api/social-feed         - Get posts with pagination",
    );
    console.log("  POST   /api/social-feed         - Create a new post");
    console.log("  POST   /api/social-feed/:id/like   - Like a post");
    console.log("  DELETE /api/social-feed/:id/like   - Unlike a post");
    console.log("  POST   /api/social-feed/:id/comments - Add comment\n");
  } catch (error) {
    console.error("❌ Error creating schema:", error.message);
    throw error;
  } finally {
    await connection.release();
  }
}

// Run
initSocialFeedSchema()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
