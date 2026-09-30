const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImNvbXBhbnlJZCI6MSwiYnJhbmNoSWQiOjEsImJyYW5jaElkc1N0ciI6IjEiLCJyb2xlcyI6WyJBRE1JTiJdLCJpYXQiOjE3ODM0NTcyMjYsImV4cCI6MTc4MzQ2MDgyNn0.0eV1LGk9Tx2B_Ty-8B5WPD00sh2CuXVl7X4ev_woX0U';
const req = http.request({
  hostname: 'localhost',
  port: 4002,
  path: '/api/bi/home-overview',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', e => console.error(e));
req.end();
