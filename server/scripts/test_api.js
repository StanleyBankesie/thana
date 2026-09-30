const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sales/prices/best-price',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', e => console.error(e));
req.write(JSON.stringify({ product_id: 4, quantity: 1 }));
req.end();
