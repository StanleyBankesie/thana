/**
 * @file debug_prices.js
 * @description Debug script for checking customers, products, and prices in the DB.
 */
import mysql from 'mysql2/promise';

// Utility function to debug customer and product pricing configurations
async function run() {
  try {
    // Initialize a database connection pool with local credentials
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'seriana_db'
    });

    // Query for a specific customer to verify their associated price_type_id
    const [customers] = await pool.query('SELECT id, customer_name, price_type_id FROM sal_customers WHERE customer_name LIKE "%Abandenden%"');
    console.log('Customers:', customers);

    // Query for a specific product to inspect its base selling_price
    const [products] = await pool.query('SELECT id, item_name, selling_price FROM inv_items WHERE item_name LIKE "%Softcare%"');
    console.log('Products:', products);

    // Retrieve all price types to understand the available pricing tiers
    const [priceTypes] = await pool.query('SELECT id, name FROM sal_price_types');
    console.log('Price Types:', priceTypes);

    // Fetch recent custom prices set for specific customers
    const [customerPrices] = await pool.query('SELECT * FROM sal_customer_prices ORDER BY id DESC LIMIT 5');
    console.log('Customer Prices:', customerPrices);

    // Close the connection pool
    await pool.end();
  } catch (err) {
    // Log any errors that occur during the queries
    console.error(err);
  }
}
// Execute the script
run();
