// Database Pool Dependency
import { query } from "../db/pool.js";

// Script to refresh Administration Settings pages in the database
async function fixSettingsPages() {
  try {
    console.log("Removing old Settings pages...");
    // Delete the old Settings page entry
    await query(
      "DELETE FROM adm_pages WHERE path = '/administration/settings' AND name = 'Settings'",
    );
    console.log("Deleted old Settings page");

    // Insert the new Settings pages
    const settingsPages = [
      {
        module: "Administration",
        name: "Settings",
        code: "ADMINISTRATION_SETTINGS",
        path: "/administration/settings",
      },
      {
        module: "Administration",
        name: "Settings List",
        code: "ADMINISTRATION_SETTINGS_LIST",
        path: "/administration/settings",
      },
      {
        module: "Administration",
        name: "Settings Form",
        code: "ADMINISTRATION_SETTINGS_FORM",
        path: "/administration/settings/new",
      },
      {
        module: "Administration",
        name: "Settings Edit",
        code: "ADMINISTRATION_SETTINGS_EDIT",
        path: "/administration/settings/:id",
      },
      {
        module: "Administration",
        name: "Settings Delete",
        code: "ADMINISTRATION_SETTINGS_DELETE",
        path: "/administration/settings/:id",
      },
    ];

    for (const page of settingsPages) {
      try {
        await query(
          "INSERT IGNORE INTO adm_pages (module, name, code, path) VALUES (:module, :name, :code, :path)",
          page,
        );
        console.log(`Inserted page: ${page.name}`);
      } catch (err) {
        console.error(`Error inserting page ${page.name}:`, err.message);
      }
    }

    console.log("Settings pages setup complete!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

fixSettingsPages();
