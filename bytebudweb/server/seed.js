import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { demoCourses, demoUnits } from "../Homedemodata.js";
import { Acquisition, Course, LaptopModel, School, Supplier, Unit, User } from "./models.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const SCHOOLS = [
  { schoolName: "University of Science and Technology of Southern Philippines", emailDomains: ["ustp.edu.ph"] },
  { schoolName: "Xavier University - Ateneo de Cagayan", emailDomains: ["xu.edu.ph"] },
  { schoolName: "Liceo de Cagayan University", emailDomains: ["liceo.edu.ph"] },
];

const ADMIN = {
  fullName: "ByteBud Admin",
  email: "admin@bytebud.com",
  password: "Admin123!", // Demo only; change before sharing the database.
};

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing. Add it to server/.env.");
}

await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected to MongoDB:", mongoose.connection.name);

try {
  for (const school of SCHOOLS) {
    await School.updateOne(
      { schoolName: school.schoolName },
      { $set: { ...school, status: "active" } },
      { upsert: true }
    );
  }

  let admin = await User.findOne({ email: ADMIN.email });
  if (!admin) {
    admin = await User.create({
      fullName: ADMIN.fullName,
      email: ADMIN.email,
      phone: "",
      passwordHash: await bcrypt.hash(ADMIN.password, 10),
      role: "admin",
    });
    console.log(`Admin created: ${ADMIN.email} / ${ADMIN.password}`);
  } else {
    console.log(`Admin already exists: ${ADMIN.email}`);
  }

  const supplier = await Supplier.findOneAndUpdate(
    { companyName: "ByteBud Demo Supplier" },
    { $set: { companyName: "ByteBud Demo Supplier", supplierType: "demo", contact: {} } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const courses = [];
  for (const course of demoCourses) {
    const savedCourse = await Course.findOneAndUpdate(
      { courseCode: course.courseCode },
      { $set: { courseName: course.courseName, requirements: course.requirements } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    courses.push(savedCourse);
  }

  const modelsByDemoId = new Map();
  for (const unit of demoUnits) {
    const demoModel = unit.model;
    const specs = demoModel.specs || {};
    const savedModel = await LaptopModel.findOneAndUpdate(
      { brand: demoModel.brand, modelName: demoModel.modelName },
      {
        $set: {
          brand: demoModel.brand,
          modelName: demoModel.modelName,
          specs: {
            ...specs,
            ramGb: unit.actualSpecs.actualRamGb,
            storageGb: unit.actualSpecs.actualStorageGb,
            storageType: unit.actualSpecs.actualStorageType,
          },
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    modelsByDemoId.set(demoModel.modelId, savedModel);
  }

  const modelCounts = new Map();
  for (const unit of demoUnits) {
    modelCounts.set(unit.model.modelId, (modelCounts.get(unit.model.modelId) || 0) + 1);
  }

  const acquisitionItems = [...modelsByDemoId.entries()].map(([demoModelId, laptopModel]) => ({
    modelId: laptopModel._id,
    quantity: modelCounts.get(demoModelId),
    unitCost: 0,
  }));

  const acquisition = await Acquisition.findOneAndUpdate(
    { invoiceNo: "DEMO-INITIAL-STOCK" },
    {
      $set: {
        supplierId: supplier._id,
        recordedBy: admin._id,
        sourceType: "demo",
        invoiceNo: "DEMO-INITIAL-STOCK",
        totalCost: 0,
        acqStatus: "received",
        acquiredAt: new Date("2026-11-01T00:00:00.000Z"),
        acqItems: acquisitionItems,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  for (const unit of demoUnits) {
    const laptopModel = modelsByDemoId.get(unit.model.modelId);
    await Unit.findOneAndUpdate(
      { serialNumber: `DEMO-${unit.unitId.toUpperCase()}` },
      {
        $set: {
          serialNumber: `DEMO-${unit.unitId.toUpperCase()}`,
          modelId: laptopModel._id,
          acquisitionId: acquisition._id,
          conditionGrade: unit.conditionGrade,
          estimatedBatteryHrs: unit.estimatedBatteryHrs,
          unitStatus: unit.unitStatus,
          reserveUntil: unit.reserveUntil,
          actualSpecs: unit.actualSpecs,
          listing: unit.listing,
          osInstalled: laptopModel.specs.os || "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`Partner schools ready: ${SCHOOLS.length}`);
  console.log(`Courses ready: ${courses.length}`);
  console.log(`Demo laptop units ready: ${demoUnits.length}`);
  console.log("Demo inventory has zeroed acquisition costs and should not be treated as real financial data.");
} finally {
  await mongoose.disconnect();
}
