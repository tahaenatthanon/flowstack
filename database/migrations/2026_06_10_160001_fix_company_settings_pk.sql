-- Fix company_settings: id had DEFAULT 1, not AUTO_INCREMENT — all multi-tenant inserts collide
ALTER TABLE `company_settings` MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
