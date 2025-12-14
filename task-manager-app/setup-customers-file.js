/**
 * Setup customers file support
 * Esegui: node setup-customers-file.js <docker-exec-command>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONTAINER = 'molino-app';
const DATA_DIR = '/app/data';
const CUSTOMERS_FILE = '/app/data/customers.json';
const OUTPUT_DIR = '/share/Container/data/molino/static';

function runDockerExec(cmd) {
  try {
    // Su Windows/locale: docker exec
    // Su NAS: /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec
    const result = execSync(`docker exec ${CONTAINER} ${cmd}`, { encoding: 'utf-8' });
    return result;
  } catch (error) {
    console.error(`Error running: ${cmd}`);
    console.error(error.message);
    throw error;
  }
}

async function setup() {
  console.log('🔄 Setting up customers file support...\n');
  
  try {
    console.log('✅ Creating /app/data directory...');
    runDockerExec(`mkdir -p ${DATA_DIR}`);
    
    console.log('✅ Exporting customers from database...');
    runDockerExec(`node /app/export-customers-to-file.js`);
    
    console.log('✅ Verifying customers.json...');
    const output = runDockerExec(`cat ${CUSTOMERS_FILE} | wc -l`);
    console.log(`   File size: ${output.trim()} lines`);
    
    console.log('✅ Creating NAS output directory...');
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    console.log('\n✨ SETUP COMPLETE!');
    console.log(`📁 Customers file (container): ${CUSTOMERS_FILE}`);
    console.log(`📁 Customers file (NAS):       ${OUTPUT_DIR}/customers.json`);
    console.log(`📁 Bind mount: /app/data -> ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
