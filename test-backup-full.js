const fs = require('fs');
const path = require('path');

const backupDir = '/app/backups';
const allBackups = [];

// 1. Cerca backup nella directory principale
const files = fs.readdirSync(backupDir);
const backupFiles = files.filter(f => f.startsWith('db-backup-') && f.endsWith('.sql'));
console.log('DB backup files:', backupFiles);

// 2. Cerca backup MariaDB
const mariadbDir = path.join(backupDir, 'mariadb');
if (fs.existsSync(mariadbDir)) {
  const mariadbFiles = fs.readdirSync(mariadbDir);
  const mariadbBackups = mariadbFiles.filter(f => f.startsWith('mariadb-backup-') && (f.endsWith('.sql') || f.endsWith('.sql.gz')));
  console.log('MariaDB backup files:', mariadbBackups);
  
  for (const filename of mariadbBackups) {
    const filePath = path.join(mariadbDir, filename);
    const stats = fs.statSync(filePath);
    allBackups.push({
      filename: `mariadb/${filename}`,
      size: stats.size,
      createdAt: stats.mtime.toISOString(),
      type: 'mariadb'
    });
  }
}

console.log('\n=== BACKUPS RESULT ===');
console.log(JSON.stringify(allBackups, null, 2));
