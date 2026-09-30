import { query } from "./db/pool.js";
import { login } from "./controllers/auth.controller.js";

async function run() {
  try {
    const req = {
      body: {
        username: "esther",
        password: "password", // whatever password is
      },
      ip: "127.0.0.1",
      headers: {}
    };
    const res = {
      status: (code) => ({
        json: (data) => console.log("Response JSON:", code, data)
      }),
      json: (data) => console.log("Response JSON:", 200, data)
    };
    const next = (err) => console.log("Next called with error:", err);

    await login(req, res, next);
  } catch (err) {
    console.error("Caught error:", err);
  } finally {
    process.exit(0);
  }
}
run();
