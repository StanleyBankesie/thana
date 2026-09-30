import fs from 'fs';

const controllerFile = 'server/controllers/transport.controller.js';
const tempFile = 'temp_transport_controllers.js';

const tempContent = fs.readFileSync(tempFile, 'utf8');
fs.appendFileSync(controllerFile, '\n' + tempContent);

console.log('Successfully appended temp_transport_controllers.js to transport.controller.js');
