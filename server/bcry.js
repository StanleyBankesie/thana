import bcrypt from "bcryptjs";
const printhashed = async () => {
  const hashed = await bcrypt.hash("Admin@123", 10);
  console.log(hashed);
};
printhashed();
