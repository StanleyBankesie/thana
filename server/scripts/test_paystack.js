import './server/utils/loadServerEnv.js';
import { initializePaystackPayment } from './server/controllers/license.controller.js';

async function main() {
  const req = {
    user: { company_id: 1, email: 'test@example.com' },
    headers: {}
  };
  const res = {
    status: (code) => ({ json: (d) => console.log('STATUS', code, d) }),
    json: (d) => console.log('OK', d)
  };
  await initializePaystackPayment(req, res);
  process.exit(0);
}
main();
