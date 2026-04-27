-- Migrate molino_production database and all tables to utf8mb4
-- so emojis (4-byte chars like 🛒) are stored correctly.

ALTER DATABASE `molino_production`
  CHARACTER SET = utf8mb4
  COLLATE       = utf8mb4_unicode_ci;

-- Generate ALTER TABLE statements for all tables
SET @s = NULL;
SELECT GROUP_CONCAT(
  CONCAT('ALTER TABLE `', table_name, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
  SEPARATOR '\n'
) INTO @s
FROM information_schema.tables
WHERE table_schema = 'molino_production' AND table_type = 'BASE TABLE';

SELECT @s AS migration_statements;
