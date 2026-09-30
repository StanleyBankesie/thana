import http from 'http';

http.get('http://localhost:4002/api/inventory/items', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${data}`);
  });
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
