const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Create a fresh database connection
const dbPath = path.join(__dirname, 'immopi.db');
const db = new sqlite3.Database(dbPath);

console.log('Step 1: Testing database connection');
db.get('SELECT COUNT(*) as cnt FROM properties', [], (err, row) => {
  if (err) {
    console.error('DB error:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('Properties count:', row.cnt);
  
  console.log('\nStep 2: Testing checkAlreadyRanThisMonth logic');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
  console.log('Month key:', currentMonthKey);
  
  db.get('SELECT lastMortgageRun FROM automation_state WHERE id = 1', [], (err, row) => {
    if (err) {
      console.error('Error checking automation_state:', err.message);
      db.close();
      process.exit(1);
    }
    const alreadyRan = row ? row.lastMortgageRun === currentMonthKey : false;
    console.log('Already ran this month:', alreadyRan);
    
    console.log('\nStep 3: Loading mortgage-automation module');
    const { runMortgageAutomation } = require('./mortgage-automation');
    console.log('Module loaded');
    
    console.log('\nStep 4: Running mortgage automation');
    const timeout = setTimeout(() => {
      console.error('TIMEOUT: Mortgage automation hung after 5 seconds');
      db.close();
      process.exit(1);
    }, 5000);
    
    runMortgageAutomation().then(result => {
      clearTimeout(timeout);
      console.log('\nResult:', JSON.stringify(result, null, 2));
      db.close();
      process.exit(0);
    }).catch(error => {
      clearTimeout(timeout);
      console.error('\nError:', error.message);
      console.error('Stack:', error.stack);
      db.close();
      process.exit(1);
    });
  });
});
