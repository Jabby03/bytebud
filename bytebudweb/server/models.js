import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Collections (names are fixed so Mongoose uses the ones you already created in Compass):
 *   users, schools, student_verifications
 *
 * Note: the data model's PKs (userId, schoolId, verificationId) are MongoDB's built-in _id.
 */

/* ---------- users ---------- */
const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["buyer", "staff", "admin"], default: "buyer" },
    isActive: { type: Boolean, default: true },
  },
  {
    collection: "users",
    timestamps: { createdAt: "userCreatedAt", updatedAt: "userUpdatedAt" },
  }
);

/* ---------- schools (partner schools) ---------- */
const schoolSchema = new Schema(
  {
    schoolName: { type: String, required: true, trim: true },
    emailDomains: { type: [String], default: [] }, // e.g. ["ustp.edu.ph"]
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  {
    collection: "schools",
    timestamps: { createdAt: "schoolCreatedAt", updatedAt: "schoolUpdatedAt" },
  }
);

/* ---------- student_verifications ---------- */
const verificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true },
    schoolEmail: { type: String, required: true, lowercase: true, trim: true },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    proofUrl: { type: String, default: "" },
    verifStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    remarks: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  {
    collection: "student_verifications",
    timestamps: { createdAt: "verifCreatedAt", updatedAt: "verifUpdatedAt" },
  }
);

export const User = mongoose.model("User", userSchema);
export const School = mongoose.model("School", schoolSchema);
export const StudentVerification = mongoose.model("StudentVerification", verificationSchema);