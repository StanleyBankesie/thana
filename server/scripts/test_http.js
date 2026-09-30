const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 4002,
  path: '/api/sales/orders',
  method: 'GET'
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${data}`);
  });
});

req.on('error', error => {
  console.error('ERROR:', error);
});

req.end();
