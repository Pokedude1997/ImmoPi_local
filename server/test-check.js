const { checkAlreadyRanThisMonth } = require('./mortgage-automation');

console.log('Calling checkAlreadyRanThisMonth...');

const timeout = setTimeout(() => {
  console.error('TIMEOUT');
  process.exit(1);
}, 3000);

checkAlreadyRanThisMonth().then(result => {
  clearTimeout(timeout);
  console.log('Result:', result);
  process.exit(0);
}).catch(error => {
  clearTimeout(timeout);
  console.error('Error:', error.message);
  process.exit(1);
});
