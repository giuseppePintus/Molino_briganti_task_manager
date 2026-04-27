-- SQL Commands per configurare MariaDB
-- Database: molino_production
-- User: molino_user
-- Password: <CONFIGURATA IN nas-config.local.sh come $DB_PASSWORD>
--
-- Sostituisci i placeholder <DB_PASSWORD> prima dell'esecuzione,
-- oppure usa setup-mariadb.sh che li valorizza dalle env vars.

-- 1. Creare database
CREATE DATABASE IF NOT EXISTS molino_production 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- 2. Creare utente applicazione (accesso da qualsiasi host)
CREATE USER IF NOT EXISTS 'molino_user'@'%' IDENTIFIED BY '<DB_PASSWORD>';

-- 3. Garantire privilegi completi sul database
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'%';

-- 4. Garantire accesso da rete locale (backup)
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'192.168.1.%';

-- 5. Garantire accesso da localhost
GRANT ALL PRIVILEGES ON molino_production.* TO 'molino_user'@'localhost';

-- 6. Flush privileges
FLUSH PRIVILEGES;

-- 7. Verificare utente creato
SELECT user, host FROM mysql.user WHERE user = 'molino_user';

-- 8. Verificare database
SHOW DATABASES;

-- 9. Selezionare database
USE molino_production;

-- 10. Verificare tabelle (dovrebbe essere vuoto)
SHOW TABLES;
