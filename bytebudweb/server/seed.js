import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, School } from "./models.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

/**
 * Run once:  npm run seed
 * Adds the partner schools and the first admin account. Safe to run again (no duplicates).
 *
 * EDIT the emailDomains below so they match the school emails you will use in the demo.
 */

const SCHOOLS = [
  { schoolName: "University of Science and Technology of Southern Philippines", emailDomains: ["ustp.edu.ph"] },
  { schoolName: "Xavier University - Ateneo de Cagayan", emailDomains: ["xu.edu.ph"] },
  { schoolName: "Liceo de Cagayan University", emailDomains: ["liceo.edu.ph"] },
];

const ADMIN = {
  fullName: "ByteBud Admin",
  email: "admin@bytebud.com",
  password: "Admin123!", // demo only: change it
};

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing. Add it to server/.env.");
}

await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected to MongoDB:", mongoose.connection.name);

for (const school of SCHOOLS) {
  await School.updateOne({ schoolName: school.schoolName }, { $set: { ...school, status: "active" } }, { upsert: true });
}
console.log(`Schools ready: ${SCHOOLS.length}`);

if (!(await User.exists({ email: ADMIN.email }))) {
  await User.create({
    fullName: ADMIN.fullName,
    email: ADMIN.email,
    passwordHash: await bcrypt.hash(ADMIN.password, 10),
    role: "admin",
  });
  console.log(`Admin created: ${ADMIN.email} / ${ADMIN.password}`);
} else {
  console.log(`Admin already exists: ${ADMIN.email}`);
}

await mongoose.disconnect();
