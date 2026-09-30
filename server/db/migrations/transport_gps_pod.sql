CREATE TABLE IF NOT EXISTS trans_trip_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0.00,
  heading DECIMAL(5, 2) DEFAULT 0.00,
  accuracy DECIMAL(8, 2) DEFAULT 0.00,
  recorded_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trans_trips(id) ON DELETE CASCADE
);

-- Add POD fields to trans_trips if they don't exist
-- Using multiple ALTER TABLE statements to avoid syntax errors if column exists
ALTER TABLE trans_trips ADD COLUMN pod_signature_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE trans_trips ADD COLUMN pod_photo_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE trans_trips ADD COLUMN pod_notes TEXT DEFAULT NULL;
ALTER TABLE trans_trips ADD COLUMN pod_timestamp DATETIME DEFAULT NULL;
