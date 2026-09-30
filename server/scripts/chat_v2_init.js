/**
 * @fileoverview Database initialization script for Chat V2 tables.
 * Provides up and down functions to create and drop chat-related tables.
 * @module scripts/chat_v2_init
 */

import { query } from "../db/pool.js";

/**
 * Creates the necessary database tables for the chat system.
 * Includes tables for conversations, participants, messages, status, attachments, presence, and deletions.
 *
 * @returns {Promise<void>} Resolves when all tables are created.
 */
// Schema creation function for Chat V2
export async function up() {
  // Create chat_conversations table for chat threads
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      created_by BIGINT UNSIGNED NOT NULL,
      is_group TINYINT(1) NOT NULL DEFAULT 0,
      title VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_creator (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner','member') NOT NULL DEFAULT 'member',
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, user_id),
      KEY idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      sender_user_id BIGINT UNSIGNED NOT NULL,
      content_type ENUM('text','image','video','document','contact') NOT NULL DEFAULT 'text',
      content TEXT NULL,
      reply_to BIGINT UNSIGNED NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      edited_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_conv_time (conversation_id, created_at),
      KEY idx_sender (sender_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_message_status (
      message_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('sent','delivered','read') NOT NULL DEFAULT 'sent',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      message_id BIGINT UNSIGNED NOT NULL,
      file_path VARCHAR(1024) NOT NULL,
      mime_type VARCHAR(255) NOT NULL,
      file_size BIGINT UNSIGNED NOT NULL DEFAULT 0,
      thumbnail_path VARCHAR(1024) NULL,
      PRIMARY KEY (id),
      KEY idx_msg (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_presence (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      is_online TINYINT(1) NOT NULL DEFAULT 0,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS chat_deleted_messages (
      message_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (message_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/**
 * Drops all database tables associated with the chat system.
 * Useful for reversing the migration or cleaning up during testing.
 *
 * @returns {Promise<void>} Resolves when all chat tables are dropped.
 */
// Schema rollback function for Chat V2
export async function down() {
  // Drop all chat tables in reverse order of dependency
  await query(`DROP TABLE IF EXISTS chat_deleted_messages`);
  await query(`DROP TABLE IF EXISTS chat_presence`);
  await query(`DROP TABLE IF EXISTS chat_attachments`);
  await query(`DROP TABLE IF EXISTS chat_message_status`);
  await query(`DROP TABLE IF EXISTS chat_messages`);
  await query(`DROP TABLE IF EXISTS chat_participants`);
  await query(`DROP TABLE IF EXISTS chat_conversations`);
}

export default { up, down };

