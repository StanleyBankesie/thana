import pool from "../db/pool.js";

/**
 * Create social feed database schema
 * Tables: posts, post_selected_users, post_likes, post_comments
 * With optimized indexes for visibility filtering
 */

const createSchema = async () => {
  const connection = await pool.getConnection();

  try {
    // 1️⃣ POSTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content LONGTEXT NOT NULL,
        image_url VARCHAR(500),
        visibility_type ENUM('company', 'warehouse', 'selected') NOT NULL DEFAULT 'company',
        warehouse_id INT,
        like_count INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
        INDEX idx_posts_visibility (visibility_type),
        INDEX idx_posts_warehouse (warehouse_id),
        INDEX idx_posts_user (user_id),
        INDEX idx_posts_created_at (created_at DESC)
      )
    `);
    console.log("✅ posts table created");

    // 2️⃣ POST_SELECTED_USERS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_selected_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_post_user (post_id, user_id),
        INDEX idx_selected_users_user (user_id),
        INDEX idx_selected_users_post (post_id)
      )
    `);
    console.log("✅ post_selected_users table created");

    // 3️⃣ POST_LIKES TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_post_like (post_id, user_id),
        INDEX idx_likes_post (post_id),
        INDEX idx_likes_user (user_id)
      )
    `);
    console.log("✅ post_likes table created");

    // 4️⃣ POST_COMMENTS TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment_text LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_comments_post (post_id),
        INDEX idx_comments_user (user_id),
        INDEX idx_comments_created (created_at DESC)
      )
    `);
    console.log("✅ post_comments table created");

    console.log("✅ Social feed schema created successfully!");
  } catch (error) {
    console.error("❌ Error creating schema:", error.message);
    throw error;
  } finally {
    await connection.release();
  }
};

// Run if executed directly
createSchema().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export default createSchema;
