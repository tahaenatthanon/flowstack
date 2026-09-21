CREATE TABLE products (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  usp TEXT DEFAULT NULL COMMENT 'จุดขาย/Unique Selling Point',
  price DECIMAL(15,2) DEFAULT NULL,
  image_url VARCHAR(1000) DEFAULT NULL,
  status ENUM('active','discontinued') NOT NULL DEFAULT 'active',
  created_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
