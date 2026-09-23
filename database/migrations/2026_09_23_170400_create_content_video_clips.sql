-- multi-clip-video: คลิปรายฉาก — 1 แถวต่อ 1 generation (append-only ไม่เขียนทับ)
-- คลิปที่ใช้งานของฉาก = แถวล่าสุด (created_at) ที่ status='done' ของ scene_id นั้น
-- scene_id อ้าง article_content.scenes[].id (identity ถาวรของฉาก) — scene_index ใช้แสดงลำดับเท่านั้น
-- input_snapshot = ข้อมูลที่ใช้ยิงจริง {image_url, video_prompt, narration, model_id, duration_sec, aspect_ratio, resolution}
--   ใช้ตรวจคลิปล้าสมัย (เทียบกับค่าปัจจุบันทุกครั้งที่อ่าน ไม่เก็บ flag)
-- credits_estimated: ประมาณการตอนยิง (0 = ยิงไม่ผ่าน, NULL = ไม่ทราบราคา/ข้อมูลที่ย้ายมา)
-- credits_actual:    ยอดจริงที่ kie ส่งกลับ (NULL = kie ไม่ได้ส่ง)

CREATE TABLE IF NOT EXISTS content_video_clips (
  id                CHAR(36)      NOT NULL,
  tenant_id         CHAR(36)      NOT NULL,
  item_id           CHAR(36)      NOT NULL,
  scene_id          VARCHAR(40)   NOT NULL,
  scene_index       INT           NOT NULL,
  model_id          CHAR(36)      NULL,
  job_id            VARCHAR(255)  NULL,
  status            ENUM('generating','done','failed') NOT NULL DEFAULT 'generating',
  clip_url          VARCHAR(1000) NULL,
  error             TEXT          NULL,
  input_snapshot    JSON          NOT NULL,
  credits_estimated INT           NULL,
  credits_actual    INT           NULL,
  created_at        DATETIME      NOT NULL,
  completed_at      DATETIME      NULL,
  updated_at        DATETIME      NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cvc_item_scene (item_id, scene_id, created_at),
  KEY idx_cvc_status (status, created_at),
  CONSTRAINT fk_cvc_item  FOREIGN KEY (item_id)  REFERENCES content_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_cvc_model FOREIGN KEY (model_id) REFERENCES ai_models (id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
