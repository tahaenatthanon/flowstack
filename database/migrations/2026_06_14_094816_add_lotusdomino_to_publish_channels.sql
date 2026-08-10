-- Add lotusdomino to publish_channels platform ENUM
ALTER TABLE publish_channels
  MODIFY COLUMN platform ENUM('wordpress','wix','custom','facebook','lineoa','instagram','tiktok','linkedin','twitter','lotusdomino') NOT NULL DEFAULT 'wordpress';
