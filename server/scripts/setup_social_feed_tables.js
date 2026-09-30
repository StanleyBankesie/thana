// Database Connection Utility
import { query } from "../db/pool.js";

/**
 * Setup social feed database schema
 * Creates posts, post_comments, post_likes tables with proper foreign keys to adm_users
 */

async function setupSocialFeed() {
  try {
    console.log("Starting social feed schema setup...");

    // 1️⃣ CREATE POSTS TABLE
    await query(`
      CREATE TABLE IF NOT EXISTS posts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        content LONGTEXT NOT NULL,
        image_url VARCHAR(500) NULL,
        visibility_type ENUM('company', 'warehouse') NOT NULL DEFAULT 'company',
        warehouse_id BIGINT UNSIGNED NULL,
        like_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
        INDEX idx_posts_visibility (visibility_type),
        INDEX idx_posts_warehouse (warehouse_id),
        INDEX idx_posts_user (user_id),
        INDEX idx_posts_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ posts table created/verified");

    // 2️⃣ CREATE POST_LIKES TABLE
    await query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        post_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_post_like (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
        INDEX idx_likes_post (post_id),
        INDEX idx_likes_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ post_likes table created/verified");

    // 3️⃣ CREATE POST_COMMENTS TABLE
    await query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        post_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        comment_text LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
        INDEX idx_comments_post (post_id),
        INDEX idx_comments_user (user_id),
        INDEX idx_comments_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ post_comments table created/verified");

    // 4️⃣ CREATE NOTIFICATIONS TABLE (for push notifications)
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        type VARCHAR(50) NOT NULL,
        reference_id BIGINT UNSIGNED NULL,
        title VARCHAR(255) NOT NULL,
        message LONGTEXT NULL,
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user (user_id, is_read),
        INDEX idx_notifications_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ notifications table created/verified");

    console.log("✅ Social feed schema setup completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error setting up social feed schema:", err.message);
    process.exit(1);
  }
}

setupSocialFeed();
