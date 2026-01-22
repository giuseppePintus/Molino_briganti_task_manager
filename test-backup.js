const fs = require('fs');
const path = require('path');
const dir = '/app/backups';
console.log('Files in backupDir:', fs.readdirSync(dir));
const md = path.join(dir, 'mariadb');
if (fs.existsSync(md)) {
  console.log('MariaDB files:', fs.readdirSync(md));
}
