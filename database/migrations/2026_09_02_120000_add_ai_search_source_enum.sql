-- Add 'ai_search' to content_research_keywords.source enum
-- AI research adapter (provider='ai') stores keyword source='ai_search',
-- but the enum did not include it, causing MariaDB to coerce to '' in non-strict mode.
ALTER TABLE `content_research_keywords`
  MODIFY COLUMN `source` enum('seed','suggestion','related','paa','serp_title','ai_search') DEFAULT NULL;
