/**
 * Demo view data for HomePage, projected from the ERD's courses, units,
 * laptop_models, student_verifications, and users collections. The *Id
 * properties are API-facing names for each MongoDB document's _id. Units
 * include a populated model and only listing fields needed by the storefront.
 *
 * The backend seed maps these storefront examples into ERD-shaped course,
 * laptop_model, acquisition, and unit documents. Leave photoUrl empty to see
 * the photo placeholder.
 */

export const demoUser = { fullName: "Juan Dela Cruz", role: "buyer" };

export const demoVerification = { verifStatus: "approved", expiresAt: "2027-06-30" };

export const demoCourses = [
  {
    courseId: "c1",
    courseCode: "BSCE",
    courseName: "Civil Engineering",
    requirements: {
      minRamGb: 16,
      minStorageGb: 512,
      minCpuTier: 3,
      gpuRequired: true,
      minBatteryHours: 4,
      reqNotes: "AutoCAD and 3D drawing need strong graphics and plenty of memory.",
    },
  },
  {
    courseId: "c2",
    courseCode: "BSIT",
    courseName: "Information Technology",
    requirements: {
      minRamGb: 8,
      minStorageGb: 256,
      minCpuTier: 2,
      gpuRequired: false,
      minBatteryHours: 5,
      reqNotes: "Coding, virtual machines, and web development.",
    },
  },
  {
    courseId: "c3",
    courseCode: "BSBA",
    courseName: "Business Administration",
    requirements: {
      minRamGb: 8,
      minStorageGb: 256,
      minCpuTier: 1,
      gpuRequired: false,
      minBatteryHours: 6,
      reqNotes: "Documents, spreadsheets, presentations, and video calls.",
    },
  },
  {
    courseId: "c4",
    courseCode: "BMMA",
    courseName: "Multimedia Arts",
    requirements: {
      minRamGb: 16,
      minStorageGb: 512,
      minCpuTier: 3,
      gpuRequired: true,
      minBatteryHours: 4,
      reqNotes: "Photo editing, video editing, and design software.",
    },
  },
];

const unit = (id, grade, hrs, status, specs, listing, model) => ({
  unitId: id,
  modelId: model.modelId,
  conditionGrade: grade,
  estimatedBatteryHrs: hrs,
  unitStatus: status,
  reserveUntil: status === "reserved" ? "2026-11-10T12:00:00Z" : null,
  actualSpecs: specs,
  listing: { photos: [{ photoUrl: "", isPrimary: true }], ...listing },
  model,
});

export const demoUnits = [
  unit("u1", "A", 9, "available",
    { actualRamGb: 16, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 28500, studentPrice: 26500, listedAt: "2026-10-30", warrantyMonths: 6 },
    { modelId: "m1", brand: "Dell", modelName: "Latitude 7420", specs: { cpuName: "Core i7-1185G7", cpuTier: 3, gpu: "Intel Iris Xe", screenSizeIn: 14, weightKg: 1.36, designBatteryHrs: 12 } }),
  unit("u2", "B", 7, "available",
    { actualRamGb: 16, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 24900, studentPrice: 22900, listedAt: "2026-10-28", warrantyMonths: 6 },
    { modelId: "m2", brand: "Lenovo", modelName: "ThinkPad T14 Gen 2", specs: { cpuName: "Core i5-1135G7", cpuTier: 2, gpu: "Intel Iris Xe", screenSizeIn: 14, weightKg: 1.47, designBatteryHrs: 14 } }),
  unit("u3", "A", 6, "available",
    { actualRamGb: 32, actualStorageGb: 1024, actualStorageType: "SSD" },
    { price: 47500, studentPrice: 44900, listedAt: "2026-10-29", warrantyMonths: 12 },
    { modelId: "m3", brand: "Dell", modelName: "Precision 5550", specs: { cpuName: "Core i7-10850H", cpuTier: 4, gpu: "NVIDIA Quadro T2000", screenSizeIn: 15.6, weightKg: 1.8, designBatteryHrs: 9 } }),
  unit("u4", "B", 5, "available",
    { actualRamGb: 16, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 38900, studentPrice: 36500, listedAt: "2026-10-25", warrantyMonths: 6 },
    { modelId: "m4", brand: "HP", modelName: "ZBook Firefly 15 G8", specs: { cpuName: "Core i7-1165G7", cpuTier: 3, gpu: "NVIDIA T500", screenSizeIn: 15.6, weightKg: 1.7, designBatteryHrs: 10 } }),
  unit("u5", "A", 10, "available",
    { actualRamGb: 16, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 32900, studentPrice: 30900, listedAt: "2026-11-01", warrantyMonths: 12 },
    { modelId: "m5", brand: "Lenovo", modelName: "ThinkPad X1 Carbon Gen 9", specs: { cpuName: "Core i7-1165G7", cpuTier: 3, gpu: "Intel Iris Xe", screenSizeIn: 14, weightKg: 1.13, designBatteryHrs: 16 } }),
  unit("u6", "C", 4, "available",
    { actualRamGb: 8, actualStorageGb: 256, actualStorageType: "SSD" },
    { price: 12500, studentPrice: 11500, listedAt: "2026-10-20", warrantyMonths: 3 },
    { modelId: "m6", brand: "Dell", modelName: "Latitude 5490", specs: { cpuName: "Core i5-8350U", cpuTier: 2, gpu: "Intel UHD 620", screenSizeIn: 14, weightKg: 1.56, designBatteryHrs: 10 } }),
  unit("u7", "B", 8, "available",
    { actualRamGb: 8, actualStorageGb: 256, actualStorageType: "SSD" },
    { price: 16900, studentPrice: 15500, listedAt: "2026-10-27", warrantyMonths: 6 },
    { modelId: "m7", brand: "HP", modelName: "EliteBook 840 G6", specs: { cpuName: "Core i5-8365U", cpuTier: 2, gpu: "Intel UHD 620", screenSizeIn: 14, weightKg: 1.48, designBatteryHrs: 14 } }),
  unit("u8", "B", 8, "reserved",
    { actualRamGb: 16, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 21900, studentPrice: 20500, listedAt: "2026-10-22", warrantyMonths: 6 },
    { modelId: "m8", brand: "Acer", modelName: "TravelMate P2", specs: { cpuName: "Core i5-1135G7", cpuTier: 2, gpu: "Intel Iris Xe", screenSizeIn: 15.6, weightKg: 1.8, designBatteryHrs: 12 } }),
  unit("u9", "A", 11, "available",
    { actualRamGb: 8, actualStorageGb: 512, actualStorageType: "SSD" },
    { price: 19500, studentPrice: null, listedAt: "2026-10-31", warrantyMonths: 6 },
    { modelId: "m9", brand: "Lenovo", modelName: "ThinkPad L14 Gen 1", specs: { cpuName: "Ryzen 5 PRO 4650U", cpuTier: 2, gpu: "Radeon Graphics", screenSizeIn: 14, weightKg: 1.6, designBatteryHrs: 13 } }),
  unit("u10", "C", 6, "available",
    { actualRamGb: 16, actualStorageGb: 256, actualStorageType: "SSD" },
    { price: 17500, studentPrice: 16200, listedAt: "2026-10-18", warrantyMonths: 3 },
    { modelId: "m10", brand: "HP", modelName: "ProBook 450 G8", specs: { cpuName: "Core i5-1135G7", cpuTier: 2, gpu: "Intel Iris Xe", screenSizeIn: 15.6, weightKg: 1.74, designBatteryHrs: 10 } }),
];
