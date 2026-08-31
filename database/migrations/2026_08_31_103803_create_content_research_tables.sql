-- ─────────────────────────────────────────────────────────────────────────────
-- Content Pipeline — ตาราง Research (ขั้นที่ 5-6 ของ flow ผลิตคอนเทนต์)
--
-- เก็บผลการดึงข้อมูลการค้นหาจริงจาก provider ภายนอก (DataForSEO เป็นเจ้าแรก)
-- แล้วส่งต่อให้ AI วิเคราะห์เป็น research brief ก่อนเขียนบทความ
--
-- ทำไมต้องเก็บ raw_* :
--   ค่าที่จ่ายเงินซื้อมาต้องตรวจย้อนหลังได้ว่า keyword/ตัวเลขมาจากไหนจริง
--   ไม่ใช่เชื่อผลที่ normalize แล้วอย่างเดียว (กฎ NO MAGIC — ทุกอย่างต้องสาวกลับได้)
--
-- ทำไม content_item_id เป็น SET NULL ไม่ใช่ CASCADE :
--   แถวนี้ทำหน้าที่เป็น cache กันจ่ายซ้ำด้วย (ดู idx_cache) — ถ้าลบคอนเทนต์แล้ว
--   ลบ research ตามไป เท่ากับทิ้งเงินที่จ่าย DataForSEO ไปแล้ว และ seed keyword เดิม
--   จะต้องยิงซื้อใหม่ การ unlink จึงถูกต้องกว่าการลบ
--   (cache lookup ไม่ได้ใช้ content_item_id เลย จึงยัง hit ได้หลัง unlink)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `content_research_jobs` (
  `id`              CHAR(36)     NOT NULL,
  `tenant_id`       CHAR(36)     NOT NULL,
  -- NULL = ยัง research ลอย ๆ ยังไม่ผูกกับคอนเทนต์ชิ้นไหน (หรือคอนเทนต์ถูกลบไปแล้ว)
  `content_item_id` CHAR(36)     DEFAULT NULL,
  `seed_keyword`    VARCHAR(255) NOT NULL,
  `provider`        VARCHAR(50)  NOT NULL COMMENT 'dataforseo | (เพิ่มเจ้าอื่นได้ผ่าน adapter)',
  `location_code`   INT(11)      NOT NULL COMMENT '2764 = ไทย (DataForSEO location_code)',
  `language_code`   VARCHAR(10)  NOT NULL COMMENT 'th | en | ...',
  `status`          ENUM('pending','fetching','analyzing','done','failed') NOT NULL DEFAULT 'pending',
  `error_msg`       VARCHAR(500) DEFAULT NULL,
  `raw_serp`        LONGTEXT     DEFAULT NULL COMMENT 'ผลดิบ SERP จาก provider (ตรวจย้อนหลัง)',
  `raw_keywords`    LONGTEXT     DEFAULT NULL COMMENT 'ผลดิบ keyword/volume จาก provider',
  `analysis`        LONGTEXT     DEFAULT NULL COMMENT 'research brief (JSON) ที่ AI สรุปจาก raw_*',
  -- ค่าที่ provider แจ้งกลับมาต่อ request; NULL = ยังไม่ยิง หรือ provider ไม่แจ้ง (ต่างจาก 0)
  `cost_usd`        DECIMAL(10,6) DEFAULT NULL,
  `fetched_at`      DATETIME     DEFAULT NULL COMMENT 'เวลาที่ได้ข้อมูลจาก provider — ใช้คิดอายุ cache',
  `analyzed_at`     DATETIME     DEFAULT NULL,
  `created_by`      CHAR(36)     NOT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT current_timestamp(),
  `updated_at`      DATETIME     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tenant_created` (`tenant_id`, `created_at`),
  KEY `idx_content_item` (`content_item_id`),
  -- ลำดับคอลัมน์ตามการใช้จริงใน cache lookup: กรอง 5 ค่าแบบเท่ากันหมด แล้วค่อยเทียบช่วงเวลา
  KEY `idx_cache` (`tenant_id`, `provider`, `location_code`, `language_code`, `seed_keyword`, `fetched_at`),
  CONSTRAINT `fk_research_jobs_content_item`
    FOREIGN KEY (`content_item_id`) REFERENCES `content_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `content_research_keywords` (
  `id`            CHAR(36)     NOT NULL,
  `job_id`        CHAR(36)     NOT NULL,
  `tenant_id`     CHAR(36)     NOT NULL,
  `keyword`       VARCHAR(255) NOT NULL,
  -- NULL = provider ไม่ส่งค่ามา ซึ่ง "ไม่รู้" ต่างจาก 0 ที่หมายถึง "ไม่มีคนค้นหา"
  -- ห้ามยุบสองกรณีนี้เข้าด้วยกัน มิฉะนั้น UI จะโชว์ 0 ให้ทุกคำที่ provider เงียบ
  `search_volume` INT(11)          DEFAULT NULL,
  `competition`   DECIMAL(5,4)     DEFAULT NULL COMMENT '0.0000-1.0000',
  `cpc`           DECIMAL(10,4)    DEFAULT NULL COMMENT 'USD',
  `difficulty`    TINYINT UNSIGNED DEFAULT NULL COMMENT 'keyword difficulty 0-100',
  `intent`        VARCHAR(20)      DEFAULT NULL COMMENT 'informational | commercial | transactional | navigational',
  `source`        ENUM('seed','suggestion','related','paa','serp_title') NOT NULL
                  COMMENT 'คำนี้โผล่มาจาก endpoint ไหน — ใช้อธิบายที่มาบน UI',
  `is_selected`   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = ผู้ใช้เลือกเป็น target keyword',
  `created_at`    DATETIME     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_job` (`job_id`),
  KEY `idx_tenant_kw` (`tenant_id`, `keyword`),
  CONSTRAINT `fk_research_keywords_job`
    FOREIGN KEY (`job_id`) REFERENCES `content_research_jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
