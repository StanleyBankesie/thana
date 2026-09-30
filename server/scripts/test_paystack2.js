const fs = require('fs');
const envFile = fs.readFileSync('./server/.env', 'utf8');
const secretKey = envFile.match(/PAYSTACK_SECRET_KEY=(.+)/)[1].trim();

fetch("https://api.paystack.co/transaction/initialize", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    email: "test@example.com",
    amount: 10000
  })
})
.then(res => res.json())
.then(data => {
  console.log("Response:", data);
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
