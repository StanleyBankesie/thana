import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  // eslint-disable-next-line no-console
  console.log(
    "Usage: node src/scripts/hashPassword.js $2a$10$Y60rDB/j14gV4eAZlyhOcOOrsNLPCNsF.PrKok0ToP8nmgIF84Qnu"
  );
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
// eslint-disable-next-line no-console
console.log(hash);
