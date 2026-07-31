console.log('Start');

const step1 = Date.now();
const { runMortgageAutomation } = require('./mortgage-automation');
const step2 = Date.now();
console.log('Module loaded in', step2 - step1, 'ms');

const timeout1 = setTimeout(() => {
  console.error('TIMEOUT at runMortgageAutomation call');
  process.exit(1);
}, 3000);

runMortgageAutomation().then(result => {
  clearTimeout(timeout1);
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(error => {
  clearTimeout(timeout1);
  console.error('Error:', error.message);
  process.exit(1);
});
