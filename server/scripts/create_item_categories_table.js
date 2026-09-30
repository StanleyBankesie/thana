import { pool } from "../db/pool.js";

async function createItemCategoriesTable() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log("Creating inv_item_categories table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_item_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        category_code VARCHAR(50) NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        parent_category_id INT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_category_id) REFERENCES inv_item_categories(id) ON DELETE SET NULL,
        INDEX idx_company (company_id),
        UNIQUE KEY uk_code (company_id, category_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Seeding default categories...");
    // Check if any categories exist
    const [rows] = await connection.query(
      "SELECT COUNT(*) as count FROM inv_item_categories"
    );
    if (rows[0].count === 0) {
      const defaultCategories = [
        { code: "CAT001", name: "Raw Materials", parent: null },
        { code: "CAT002", name: "Finished Goods", parent: null },
        { code: "CAT003", name: "Consumables", parent: null },
        { code: "CAT004", name: "Electronics", parent: null },
        { code: "CAT005", name: "Mechanical Parts", parent: null },
      ];

      for (const cat of defaultCategories) {
        await connection.query(
          `
          INSERT INTO inv_item_categories (company_id, category_code, category_name, parent_category_id, is_active)
          VALUES (1, ?, ?, ?, 1)
        `,
          [cat.code, cat.name, cat.parent]
        );
      }
      console.log(`Seeded ${defaultCategories.length} default categories.`);
    } else {
      console.log("Categories already exist, skipping seed.");
    }

    await connection.commit();
    console.log("Done.");
  } catch (err) {
    await connection.rollback();
    console.error("Error creating/seeding item categories:", err);
  } finally {
    connection.release();
    process.exit();
  }
}

createItemCategoriesTable();
