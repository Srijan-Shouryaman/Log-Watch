const fs = require('fs');
const levels = ['INFO', 'WARN', 'ERROR'];
const messages = [
  'Server started', 'Request received', 'Database connected',
  'Connection timeout', 'Invalid token', 'Rate limit exceeded',
  'Cache miss', 'User logged in', 'Payment processed'
];

for (let i = 1; i <= 5; i++) {
  let content = '';
  const lines = Math.floor(Math.random() * 200) + 50;
  for (let j = 0; j < lines; j++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const date = new Date().toISOString();
    content += `[${date}] ${level}: ${msg}\n`;
  }
  fs.writeFileSync(`logs/app${i}.log`, content);
}
console.log('Log files generated');
