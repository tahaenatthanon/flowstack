ALTER TABLE content_publish_queue
  ADD COLUMN content_override TEXT NULL AFTER channel_id;
