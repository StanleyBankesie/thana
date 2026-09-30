import { listLogbooks } from "./controllers/transport-logbook.controller.js";

const req = {
  scope: { companyId: 1 }
};
const res = {
  json: (data) => console.log("Response:", data)
};
const next = (err) => console.error("Error:", err);

listLogbooks(req, res, next);
