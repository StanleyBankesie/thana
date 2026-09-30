const fs = require('fs');
let c = fs.readFileSync('backups/db_20260703_093731.sql', 'utf8');
c = c.replace(/X'([0-9a-fA-F]+)'##/g, "X'$1'");
fs.writeFileSync('backups/db_20260703_093731.sql', c);
