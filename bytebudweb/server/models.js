import mongoose from "mongoose";

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// The ERD names each collection's primary key (for example, userId), while
// MongoDB stores that value as _id. Mongoose aliases are not used so the
// standard MongoDB _id behavior remains available to the existing API.
const embedded = (definition) => new Schema(definition, { _id: false });
const timestamps = (createdAt, updatedAt) => ({
  timestamps: { createdAt, updatedAt },
});
const nonNegative = { type: Number, min: 0 };

/* ---------- 1. USERS ---------- */
const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["buyer", "staff", "admin"], default: "buyer" },
    isActive: { type: Boolean, default: true },
  },
  { collection: "users", ...timestamps("userCreatedAt", "userUpdatedAt") }
);

/* ---------- 2. STUDENT_VERIFICATIONS ---------- */
const studentVerificationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    verifiedBy: { type: ObjectId, ref: "User", default: null },
    schoolEmail: { type: String, required: true, lowercase: true, trim: true },
    proofUrl: { type: String, default: "" },
    verifStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    remarks: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { collection: "student_verifications", ...timestamps("verifCreatedAt", "verifUpdatedAt") }
);

/* ---------- 3. PASSWORD_RESETS ---------- */
const passwordResetSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    resetExpiresAt: { type: Date, required: true },
    resetUsedAt: { type: Date, default: null },
  },
  { collection: "password_resets", ...timestamps("resetCreatedAt", false) }
);

/* ---------- 4. SUPPLIERS ---------- */
const supplierContactSchema = embedded({
  contactPerson: { type: String, default: "" },
  contactEmail: { type: String, lowercase: true, trim: true, default: "" },
  contactPhone: { type: String, default: "" },
});

const supplierSchema = new Schema(
  {
    companyName: { type: String, required: true, trim: true },
    supplierType: { type: String, required: true, trim: true },
    contact: { type: supplierContactSchema, default: () => ({}) },
  },
  { collection: "suppliers", ...timestamps("supplierCreatedAt", "supplierUpdatedAt") }
);

/* ---------- 5. LAPTOP_MODELS ---------- */
const laptopSpecsSchema = embedded({
  cpuName: { type: String, default: "" },
  cpuTier: { type: Number, min: 0, default: null },
  ramGb: { type: Number, min: 0, default: null },
  storageGb: { type: Number, min: 0, default: null },
  storageType: { type: String, default: "" },
  gpu: { type: String, default: "" },
  // The supplied diagram labels this field as a string.
  hasDedicatedGpu: { type: String, default: "" },
  screenSizeIn: { type: Number, min: 0, default: null },
  weightKg: { type: Number, min: 0, default: null },
  os: { type: String, default: "" },
  designBatteryHrs: { type: Number, min: 0, default: null },
});

const laptopModelSchema = new Schema(
  {
    brand: { type: String, required: true, trim: true },
    modelName: { type: String, required: true, trim: true },
    msrp: nonNegative,
    specs: { type: laptopSpecsSchema, default: () => ({}) },
  },
  { collection: "laptop_models", ...timestamps("modelCreatedAt", "modelUpdatedAt") }
);

/* ---------- 6. ACQUISITIONS ---------- */
const acquisitionItemSchema = embedded({
  modelId: { type: ObjectId, ref: "LaptopModel", required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  unitCost: { type: Number, required: true, min: 0 },
});

const acquisitionSchema = new Schema(
  {
    supplierId: { type: ObjectId, ref: "Supplier", required: true, index: true },
    recordedBy: { type: ObjectId, ref: "User", required: true },
    sourceType: { type: String, required: true, trim: true },
    invoiceNo: { type: String, trim: true, default: "" },
    totalCost: nonNegative,
    acqStatus: { type: String, required: true, trim: true },
    acquiredAt: { type: Date, default: null },
    acqItems: { type: [acquisitionItemSchema], default: [] },
  },
  { collection: "acquisitions", ...timestamps("acqCreatedAt", "acqUpdatedAt") }
);

/* ---------- 7. COURSES ---------- */
const courseRequirementsSchema = embedded({
  minRamGb: { type: Number, min: 0, default: null },
  minStorageGb: { type: Number, min: 0, default: null },
  minCpuTier: { type: Number, min: 0, default: null },
  gpuRequired: { type: Boolean, default: false },
  minBatteryHours: { type: Number, min: 0, default: null },
  reqNotes: { type: String, default: "" },
});

const courseSchema = new Schema(
  {
    courseCode: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    requirements: { type: courseRequirementsSchema, default: () => ({}) },
  },
  { collection: "courses", ...timestamps("courseCreatedAt", "courseUpdatedAt") }
);

/* ---------- 8. UNITS ---------- */
const actualSpecsSchema = embedded({
  actualRamGb: { type: Number, min: 0, default: null },
  actualStorageGb: { type: Number, min: 0, default: null },
  actualStorageType: { type: String, default: "" },
});

const listingPhotoSchema = embedded({
  photoUrl: { type: String, default: "" },
  isPrimary: { type: Boolean, default: false },
});

const listingSchema = embedded({
  price: nonNegative,
  studentPrice: nonNegative,
  warrantyMonths: { type: Number, min: 0, default: null },
  listedAt: { type: Date, default: null },
  photos: { type: [listingPhotoSchema], default: [] },
});

const inspectionSchema = embedded({
  inspectedBy: { type: ObjectId, ref: "User", required: true },
  inspectedAt: { type: Date, default: Date.now },
  dataWiped: { type: Boolean, default: false },
  wipeMethod: { type: String, default: "" },
  screenOk: { type: Boolean, default: false },
  keyboardOk: { type: Boolean, default: false },
  portsOk: { type: Boolean, default: false },
  batteryOk: { type: Boolean, default: false },
  passed: { type: Boolean, default: false },
  inspectNotes: { type: String, default: "" },
});

const repairSchema = embedded({
  repairedBy: { type: ObjectId, ref: "User", required: true },
  repairedAt: { type: Date, default: Date.now },
  partReplaced: { type: String, default: "" },
  partCost: nonNegative,
  laborCost: nonNegative,
  repairNotes: { type: String, default: "" },
});

const unitSchema = new Schema(
  {
    serialNumber: { type: String, required: true, unique: true, trim: true },
    modelId: { type: ObjectId, ref: "LaptopModel", required: true, index: true },
    acquisitionId: { type: ObjectId, ref: "Acquisition", required: true, index: true },
    costBasis: nonNegative,
    conditionGrade: { type: String, required: true, trim: true },
    cosmeticNotes: { type: String, default: "" },
    batteryHealthPct: { type: Number, min: 0, max: 100, default: null },
    estimatedBatteryHrs: { type: Number, min: 0, default: null },
    osInstalled: { type: String, default: "" },
    accessories: { type: [String], default: [] },
    unitStatus: { type: String, required: true, trim: true },
    reserveUntil: { type: Date, default: null },
    actualSpecs: { type: actualSpecsSchema, default: () => ({}) },
    listing: { type: listingSchema, default: () => ({}) },
    inspections: { type: [inspectionSchema], default: [] },
    repairs: { type: [repairSchema], default: [] },
  },
  { collection: "units", ...timestamps("unitCreatedAt", "unitUpdatedAt") }
);

/* ---------- 9. CARTS ---------- */
const cartItemSchema = embedded({
  unitId: { type: ObjectId, ref: "Unit", required: true },
  addedAt: { type: Date, default: Date.now },
});

const cartSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, unique: true },
    cartItems: { type: [cartItemSchema], default: [] },
  },
  { collection: "carts", ...timestamps("cartCreatedAt", "cartUpdatedAt") }
);

/* ---------- 10. ORDERS ---------- */
const paymentSchema = embedded({
  method: { type: String, default: "" },
  payStatus: { type: String, default: "" },
  reference: { type: String, default: "" },
  paidAt: { type: Date, default: null },
});

const orderStatusHistorySchema = embedded({
  newStatus: { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: ObjectId, ref: "User", default: null },
});

const orderSnapshotSchema = embedded({
  snapBrand: { type: String, default: "" },
  snapModelName: { type: String, default: "" },
  snapSerialNumber: { type: String, default: "" },
  snapConditionGrades: { type: String, default: "" },
});

const orderItemSchema = embedded({
  unitId: { type: ObjectId, ref: "Unit", required: true },
  priceAtSale: { type: Number, required: true, min: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  returnDeadline: { type: Date, default: null },
  snapshot: { type: orderSnapshotSchema, default: () => ({}) },
});

const orderReturnSchema = embedded({
  returnUnitId: { type: ObjectId, ref: "Unit", required: true },
  reason: { type: String, default: "" },
  returnStatus: { type: String, default: "" },
  requestedAt: { type: Date, default: Date.now },
  returnResolveAt: { type: Date, default: null },
  refundAmount: { type: Number, min: 0, default: 0 },
});

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true, trim: true },
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    verificationId: { type: ObjectId, ref: "StudentVerification", default: null },
    subtotal: nonNegative,
    discountTotal: { type: Number, min: 0, default: 0 },
    total: nonNegative,
    orderStatus: { type: String, required: true, trim: true },
    pickupDate: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    payment: { type: paymentSchema, default: () => ({}) },
    statusHistory: { type: [orderStatusHistorySchema], default: [] },
    orderItems: { type: [orderItemSchema], default: [] },
    returns: { type: [orderReturnSchema], default: [] },
  },
  { collection: "orders", ...timestamps("orderCreatedAt", "orderUpdatedAt") }
);

/* ---------- 11. WARRANTIES ---------- */
const warrantyClaimSchema = embedded({
  claimNo: { type: String, default: "" },
  claimType: { type: String, default: "" },
  description: { type: String, default: "" },
  claimStatus: { type: String, default: "" },
  cost: { type: Number, min: 0, default: 0 },
  filedAt: { type: Date, default: null },
  claimResolvedAt: { type: Date, default: null },
  resolution: { type: String, default: "" },
  handledBy: { type: ObjectId, ref: "User", default: null },
});

const warrantySchema = new Schema(
  {
    orderId: { type: ObjectId, ref: "Order", required: true, index: true },
    unitId: { type: ObjectId, ref: "Unit", required: true, index: true },
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    extensionMonths: { type: Number, min: 0, default: 0 },
    source: { type: String, required: true, trim: true },
    claims: { type: [warrantyClaimSchema], default: [] },
  },
  { collection: "warranties", ...timestamps("warrantyCreatedAt", "warrantyUpdatedAt") }
);

/* ---------- 12. AUDIT_LOGS ---------- */
const auditChangesSchema = embedded({
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
});

const auditLogSchema = new Schema(
  {
    adminId: { type: ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true },
    targetCollection: { type: String, required: true, trim: true },
    targetId: { type: ObjectId, default: null },
    changes: { type: auditChangesSchema, default: () => ({}) },
  },
  { collection: "audit_logs", ...timestamps("logCreatedAt", false) }
);

export const User = mongoose.model("User", userSchema);
export const StudentVerification = mongoose.model("StudentVerification", studentVerificationSchema);
export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
export const Supplier = mongoose.model("Supplier", supplierSchema);
export const Acquisition = mongoose.model("Acquisition", acquisitionSchema);
export const LaptopModel = mongoose.model("LaptopModel", laptopModelSchema);
export const Course = mongoose.model("Course", courseSchema);
export const Unit = mongoose.model("Unit", unitSchema);
export const Cart = mongoose.model("Cart", cartSchema);
export const Order = mongoose.model("Order", orderSchema);
export const Warranty = mongoose.model("Warranty", warrantySchema);
export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
