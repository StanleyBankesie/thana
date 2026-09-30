/**
 * @file 007-create-indexes.js
 * @description Database migration script to ensure all necessary indexes are created.
 */
import { ensureIndexes } from "../../utils/ensureIndexes.js";

export async function up(db) {
  const n = await ensureIndexes(db);
  console.log(`Migration 007: Created ${n} missing database index(es)`);
}

export async function down() {
  console.log(
    "Migration 007 cannot be reversed automatically. Remove indexes manually if needed.",
  );
}
