const fs = require('fs');
const envFile = fs.readFileSync('./server/.env', 'utf8');
const secretKey = envFile.match(/PAYSTACK_SECRET_KEY=(.+)/)[1].trim();

fetch("https://api.paystack.co/transaction/verify/uaxhc7m8oh", {
  method: "GET",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json"
  }
})
.then(res => res.json())
.then(data => {
  console.log("Response:", JSON.stringify(data, null, 2));
  process.exit(0);
})
.catch(err => {
  console.error(err);
  process.exit(1);
});
