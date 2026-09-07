-- Content Research — make Research mandatory for AI Content Generation
-- New tenants default to AI Research; existing tenants are migrated only when
-- they were still using the old unconfigured default ('none').

ALTER TABLE `content_global_settings`
  MODIFY COLUMN `research_provider` VARCHAR(50) NOT NULL DEFAULT 'ai'
    COMMENT 'ai | dataforseo; Research is mandatory for Content Generation';

UPDATE `content_global_settings`
SET `research_provider` = 'ai'
WHERE `research_provider` = 'none';
