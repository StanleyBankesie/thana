import fs from 'fs';

// 1. Update transport.controller.js
let controllerPath = 'server/controllers/transport.controller.js';
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

const returnTripLogic = `
export const returnTrip = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { end_time, end_odometer, remarks } = req.body;
    
    // Status can be COMPLETED
    await query(
      \`UPDATE trans_trips 
       SET status = 'COMPLETED', end_time = :end_time, end_odometer = :end_odometer, remarks = CONCAT(IFNULL(remarks, ''), '\\n', :remarks)
       WHERE id = :id AND company_id = :companyId\`,
      { id, companyId, end_time: end_time || null, end_odometer: end_odometer || null, remarks: remarks || '' }
    );

    // Free up driver and vehicle
    const [trip] = await query(\`SELECT vehicle_id, driver_id FROM trans_trips WHERE id = :id\`, { id });
    if (trip) {
      await query(\`UPDATE trans_vehicles SET status = 'AVAILABLE' WHERE id = :vid\`, { vid: trip.vehicle_id });
      await query(\`UPDATE trans_drivers SET status = 'AVAILABLE' WHERE id = :did\`, { did: trip.driver_id });
    }

    res.json({ success: true, message: "Trip returned successfully" });
  } catch (err) {
    next(err);
  }
};
`;

if (!controllerContent.includes('export const returnTrip')) {
  controllerContent += returnTripLogic;
  fs.writeFileSync(controllerPath, controllerContent);
  console.log('Updated transport.controller.js');
}

// 2. Update transport.route.js
let routePath = 'server/routes/transport.route.js';
let routeContent = fs.readFileSync(routePath, 'utf8');

if (!routeContent.includes('returnTrip')) {
  routeContent = routeContent.replace(
    /listTrips, createTrip,/,
    `listTrips, createTrip, returnTrip,`
  );
  
  routeContent = routeContent.replace(
    /router\.post\("\/trips", requireAuth, requireCompanyScope, requirePermission\("TRANSPORT.TRIPS.CREATE"\), createTrip\);/,
    `$&
router.put("/trips/:id/return", requireAuth, requireCompanyScope, requirePermission("TRANSPORT.TRIPS.EDIT"), returnTrip);`
  );
  
  fs.writeFileSync(routePath, routeContent);
  console.log('Updated transport.route.js');
}
