import { query } from "../db/pool.js";

/**
 * Universal Asset & Property Synchronization Service
 * Keeps Facilities Management, Asset Management, Maintenance, and Inventory (FIXED_ASSET) in sync.
 */

// 1. Sync Property across FM and Asset Management
export async function syncProperty({
  source, // 'FM' or 'ASSET'
  sourceId,
  companyId,
  branchId = 1,
  property_code,
  property_name,
  property_type,
  address,
  city,
  action = 'UPSERT' // 'UPSERT' or 'DEACTIVATE'
}) {
  if (!property_name || !property_name.trim()) return;
  const compId = Number(companyId || 1);
  const code = (property_code || '').trim() || `PROP-${Date.now().toString().slice(-4)}`;
  const name = property_name.trim();

  try {
    if (source === 'FM') {
      // Sync into ast_properties
      if (action === 'DEACTIVATE') {
        await query(
          `UPDATE ast_properties SET is_active = 0 WHERE property_code = :code AND (company_id = :compId OR company_id = 1)`,
          { code, compId }
        );
      } else {
        const existing = await query(
          `SELECT id FROM ast_properties WHERE property_code = :code AND (company_id = :compId OR company_id = 1) LIMIT 1`,
          { code, compId }
        );
        if (existing.length > 0) {
          await query(
            `UPDATE ast_properties SET
               property_name = :name,
               property_type = :property_type,
               address = :address,
               city = :city,
               is_active = 1
             WHERE id = :id`,
            {
              id: existing[0].id,
              name,
              property_type: property_type || 'SITE',
              address: address || null,
              city: city || null
            }
          );
        } else {
          await query(
            `INSERT INTO ast_properties (company_id, property_code, property_name, property_type, address, city, is_active)
             VALUES (:compId, :code, :name, :property_type, :address, :city, 1)`,
            {
              compId,
              code,
              name,
              property_type: property_type || 'SITE',
              address: address || null,
              city: city || null
            }
          );
        }
      }
    } else if (source === 'ASSET') {
      // Sync into fm_properties
      if (action === 'DEACTIVATE') {
        await query(
          `UPDATE fm_properties SET status = 'INACTIVE' WHERE property_code = :code AND (company_id = :compId OR company_id = 1)`,
          { code, compId }
        );
      } else {
        const existing = await query(
          `SELECT id FROM fm_properties WHERE property_code = :code AND (company_id = :compId OR company_id = 1) LIMIT 1`,
          { code, compId }
        );
        if (existing.length > 0) {
          await query(
            `UPDATE fm_properties SET
               property_name = :name,
               property_type = :property_type,
               address = :address,
               city = :city,
               status = 'ACTIVE'
             WHERE id = :id`,
            {
              id: existing[0].id,
              name,
              property_type: property_type || 'COMMERCIAL_OFFICE',
              address: address || null,
              city: city || null
            }
          );
        } else {
          await query(
            `INSERT INTO fm_properties (company_id, branch_id, property_code, property_name, property_type, address, city, status)
             VALUES (:compId, :branchId, :code, :name, :property_type, :address, :city, 'ACTIVE')`,
            {
              compId,
              branchId: Number(branchId || 1),
              code,
              name,
              property_type: property_type || 'COMMERCIAL_OFFICE',
              address: address || null,
              city: city || null
            }
          );
        }
      }
    }
  } catch (err) {
    console.error("Error syncing property across FM and Asset Management:", err.message);
  }
}

// 2. Sync Asset across Asset Management, Maintenance, and Inventory (Fixed Asset)
export async function syncAsset({
  source, // 'ASSET', 'MAINT_ASSET', 'MAINT_EQUIP', 'INVENTORY'
  companyId,
  branchId = 1,
  asset_code,
  asset_name,
  category_name,
  property_id,
  building_id,
  space_id,
  location,
  serial_number,
  make,
  brand,
  model,
  purchase_date,
  purchase_cost,
  warranty_expiry,
  status = 'ACTIVE',
  notes
}) {
  if (!asset_name || !asset_name.trim()) return;
  const compId = Number(companyId || 1);
  const brId = Number(branchId || 1);
  const code = (asset_code || '').trim() || `AST-${Date.now().toString().slice(-5)}`;
  const name = asset_name.trim();
  const mMake = make || brand || null;
  const mBrand = brand || make || null;

  try {
    // 1. Sync to maint_assets
    if (source !== 'MAINT_ASSET') {
      const existingMaintAsset = await query(
        `SELECT id FROM maint_assets WHERE (asset_no = :code OR (serial_number = :serial_number AND :serial_number IS NOT NULL AND :serial_number != '')) AND (company_id = :compId OR company_id = 1) LIMIT 1`,
        { code, serial_number: serial_number || null, compId }
      );
      if (existingMaintAsset.length > 0) {
        await query(
          `UPDATE maint_assets SET
             asset_name = :name,
             property_id = COALESCE(:property_id, property_id),
             building_id = COALESCE(:building_id, building_id),
             space_id = COALESCE(:space_id, space_id),
             location = COALESCE(:location, location),
             category = COALESCE(:category_name, category),
             make = COALESCE(:make, make),
             model = COALESCE(:model, model),
             serial_number = COALESCE(:serial_number, serial_number),
             warranty_expiry_date = COALESCE(:warranty_expiry, warranty_expiry_date),
             notes = COALESCE(:notes, notes)
           WHERE id = :id`,
          {
            id: existingMaintAsset[0].id,
            name,
            property_id: property_id || null,
            building_id: building_id || null,
            space_id: space_id || null,
            location: location || null,
            category_name: category_name || null,
            make: mMake,
            model: model || null,
            serial_number: serial_number || null,
            warranty_expiry: warranty_expiry || null,
            notes: notes || null
          }
        );
      } else {
        await query(
          `INSERT INTO maint_assets
             (company_id, branch_id, asset_no, asset_name, location, status, notes,
              property_id, building_id, space_id, category, make, model, serial_number, warranty_expiry_date)
           VALUES
             (:compId, :brId, :code, :name, :location, :status, :notes,
              :property_id, :building_id, :space_id, :category_name, :make, :model, :serial_number, :warranty_expiry)`,
          {
            compId,
            brId,
            code,
            name,
            location: location || null,
            status: status === 'ACTIVE' || status === 'IN_USE' ? 'ACTIVE' : status,
            notes: notes || null,
            property_id: property_id || null,
            building_id: building_id || null,
            space_id: space_id || null,
            category_name: category_name || null,
            make: mMake,
            model: model || null,
            serial_number: serial_number || null,
            warranty_expiry: warranty_expiry || null
          }
        );
      }
    }

    // 2. Sync to maint_equipment
    if (source !== 'MAINT_EQUIP') {
      const existingEquip = await query(
        `SELECT id FROM maint_equipment WHERE (equipment_code = :code OR (serial_number = :serial_number AND :serial_number IS NOT NULL AND :serial_number != '')) AND (company_id = :compId OR company_id = 1) LIMIT 1`,
        { code, serial_number: serial_number || null, compId }
      );
      if (existingEquip.length > 0) {
        await query(
          `UPDATE maint_equipment SET
             equipment_name = :name,
             category = COALESCE(:category_name, category),
             location = COALESCE(:location, location),
             brand = COALESCE(:brand, brand),
             model = COALESCE(:model, model),
             serial_number = COALESCE(:serial_number, serial_number),
             purchase_date = COALESCE(:purchase_date, purchase_date),
             warranty_expiry = COALESCE(:warranty_expiry, warranty_expiry),
             notes = COALESCE(:notes, notes)
           WHERE id = :id`,
          {
            id: existingEquip[0].id,
            name,
            category_name: category_name || null,
            location: location || null,
            brand: mBrand,
            model: model || null,
            serial_number: serial_number || null,
            purchase_date: purchase_date || null,
            warranty_expiry: warranty_expiry || null,
            notes: notes || null
          }
        );
      } else {
        await query(
          `INSERT INTO maint_equipment
             (company_id, branch_id, equipment_code, equipment_name, category, location,
              brand, model, serial_number, purchase_date, warranty_expiry, status, notes)
           VALUES
             (:compId, :brId, :code, :name, :category_name, :location,
              :brand, :model, :serial_number, :purchase_date, :warranty_expiry, :status, :notes)`,
          {
            compId,
            brId,
            code,
            name,
            category_name: category_name || null,
            location: location || null,
            brand: mBrand,
            model: model || null,
            serial_number: serial_number || null,
            purchase_date: purchase_date || null,
            warranty_expiry: warranty_expiry || null,
            status: status === 'ACTIVE' || status === 'IN_USE' ? 'ACTIVE' : status,
            notes: notes || null
          }
        );
      }
    }

    // 3. Sync to ast_assets (Fixed Asset Register)
    if (source !== 'ASSET') {
      const existingAstAsset = await query(
        `SELECT id FROM ast_assets WHERE (asset_code = :code OR (serial_number = :serial_number AND :serial_number IS NOT NULL AND :serial_number != '')) AND (company_id = :compId OR company_id = 1) LIMIT 1`,
        { code, serial_number: serial_number || null, compId }
      );
      if (existingAstAsset.length > 0) {
        await query(
          `UPDATE ast_assets SET
             asset_name = :name,
             property_id = COALESCE(:property_id, property_id),
             building_id = COALESCE(:building_id, building_id),
             space_id = COALESCE(:space_id, space_id),
             location = COALESCE(:location, location),
             make = COALESCE(:make, make),
             model = COALESCE(:model, model),
             serial_number = COALESCE(:serial_number, serial_number),
             purchase_date = COALESCE(:purchase_date, purchase_date),
             warranty_expiry_date = COALESCE(:warranty_expiry, warranty_expiry_date),
             notes = COALESCE(:notes, notes)
           WHERE id = :id`,
          {
            id: existingAstAsset[0].id,
            name,
            property_id: property_id || null,
            building_id: building_id || null,
            space_id: space_id || null,
            location: location || null,
            make: mMake,
            model: model || null,
            serial_number: serial_number || null,
            purchase_date: purchase_date || null,
            warranty_expiry: warranty_expiry || null,
            notes: notes || null
          }
        );
      } else {
        // Resolve category if possible or default to 1
        let catId = 1;
        if (category_name) {
          const cat = await query(
            `SELECT id FROM ast_asset_categories WHERE (category_name LIKE :cname OR category_code LIKE :cname) AND (company_id = :compId OR company_id = 1) LIMIT 1`,
            { cname: `%${category_name}%`, compId }
          );
          if (cat.length > 0) catId = cat[0].id;
        }

        const cost = Number(purchase_cost || 0);
        await query(
          `INSERT INTO ast_assets
             (company_id, branch_id, asset_code, asset_name, category_id, property_id,
              building_id, space_id, location, serial_number, make, model, purchase_date,
              purchase_cost, salvage_value, current_nbv, accumulated_depreciation, status, notes)
           VALUES
             (:compId, :brId, :code, :name, :catId, :property_id,
              :building_id, :space_id, :location, :serial_number, :make, :model, :purchase_date,
              :cost, 0, :cost, 0, :status, :notes)`,
          {
            compId,
            brId,
            code,
            name,
            catId,
            property_id: property_id || null,
            building_id: building_id || null,
            space_id: space_id || null,
            location: location || null,
            serial_number: serial_number || null,
            make: mMake,
            model: model || null,
            purchase_date: purchase_date || null,
            cost,
            status: status === 'ACTIVE' || status === 'IN_USE' ? 'IN_USE' : status,
            notes: notes || null
          }
        );
      }
    }

    // 4. Sync to inv_items when item_type = 'FIXED_ASSET'
    if (source === 'INVENTORY' || source === 'ASSET') {
      const existingInvItem = await query(
        `SELECT id FROM inv_items WHERE (item_code = :code OR barcode = :code) AND (company_id = :compId OR company_id = 1) LIMIT 1`,
        { code, compId }
      );
      if (existingInvItem.length > 0) {
        await query(
          `UPDATE inv_items SET
             item_name = :name,
             cost_price = COALESCE(:cost, cost_price),
             item_type = 'FIXED_ASSET'
           WHERE id = :id`,
          {
            id: existingInvItem[0].id,
            name,
            cost: purchase_cost ? Number(purchase_cost) : null
          }
        );
      } else if (source === 'ASSET') {
        // Create matching inventory item tagged FIXED_ASSET
        await query(
          `INSERT INTO inv_items
             (company_id, branch_id, item_code, item_name, uom, cost_price, selling_price, item_type, is_active, is_stockable, is_sellable, is_purchasable)
           VALUES
             (:compId, :brId, :code, :name, 'PCS', :cost, 0, 'FIXED_ASSET', 1, 'Y', 'N', 'Y')`,
          {
            compId,
            brId,
            code,
            name,
            cost: Number(purchase_cost || 0)
          }
        );
      }
    }
  } catch (err) {
    console.error("Error syncing asset across Asset Management, Maintenance, and Inventory:", err.message);
  }
}
