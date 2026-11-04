import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import {
  Acquisition, AuditLog, Course, LaptopModel, Order, PasswordReset,
  StudentVerification, Supplier, Unit, User, Warranty,
} from "./models.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)), override: true });

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- helpers ---------- */

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (user) => ({
  userId: user._id,
  fullName: user.fullName,
  phone: user.phone,
  email: user.email,
  role: user.role,
});

// Latest verification of a user (or null). Used for student pricing on the Home page.
async function latestVerification(userId) {
  const v = await StudentVerification.findOne({ userId }).sort({ verifCreatedAt: -1 }).lean();
  return v
    ? { verificationId: v._id, verifStatus: v.verifStatus, expiresAt: v.expiresAt, remarks: v.remarks }
    : null;
}

async function sessionPayload(user) {
  return {
    token: signToken(user),
    user: publicUser(user),
    verification: await latestVerification(user._id),
  };
}

const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Please log in." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ message: "Please log in again." });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
};

const requireAdmin = (req, res, next) => req.user.role === "admin"
  ? next()
  : res.status(403).json({ message: "Admin access is required." });
const requireStaff = (req, res, next) => ["admin", "staff"].includes(req.user.role)
  ? next()
  : res.status(403).json({ message: "Staff access is required." });

const ADMIN_ONLY = new Set(["acquisitions", "suppliers", "users", "audit_logs"]);
const ADMIN_WRITE_ONLY = new Set(["laptop_models", "courses"]);
const MODELS = {
  units: Unit, acquisitions: Acquisition, suppliers: Supplier, orders: Order,
  student_verifications: StudentVerification, warranties: Warranty,
  laptop_models: LaptopModel, courses: Course, users: User, audit_logs: AuditLog,
};
const ID_FIELDS = {
  units: "unitId", acquisitions: "acquisitionId", suppliers: "supplierId", orders: "orderId",
  student_verifications: "verificationId", warranties: "warrantyId", laptop_models: "modelId",
  courses: "courseId", users: "userId", audit_logs: "logId",
};
const serialize = (collection, doc) => {
  if (!doc) return null;
  const value = doc.toObject ? doc.toObject() : doc;
  const { _id, __v, passwordHash, ...rest } = value;
  return { [ID_FIELDS[collection]]: String(_id), ...rest };
};
const cleanInput = (collection, body, actorId) => {
  const { _id, __v, passwordHash, role, isActive, ...input } = body || {};
  if (collection === "users") return { ...input, role: "staff", isActive: true };
  if (collection === "acquisitions") input.recordedBy = actorId;
  return input;
};
async function writeAudit(req, action, collection, doc, before = null) {
  const auditSafe = (value) => {
    if (!value) return null;
    const copy = { ...value };
    delete copy.passwordHash;
    return copy;
  };
  await AuditLog.create({
    adminId: req.user._id,
    action,
    targetCollection: collection,
    targetId: doc?._id || before?._id || null,
    changes: { before: auditSafe(before), after: doc ? auditSafe(doc.toObject()) : null },
  });
}

/* ---------- routes ---------- */

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, database: mongoose.connection.name })
);

// Public storefront view assembled from courses, units, and laptop_models.
app.get("/api/catalog/home", async (_req, res) => {
  try {
    const [courses, units] = await Promise.all([
      Course.find().sort({ courseCode: 1 }).lean(),
      Unit.find({
        unitStatus: { $in: ["available", "reserved"] },
        "listing.price": { $type: "number" },
      })
        .populate("modelId", "brand modelName specs")
        .sort({ "listing.listedAt": -1 })
        .lean(),
    ]);

    res.json({
      courses: courses.map(({ _id, ...course }) => ({ courseId: String(_id), ...course })),
      units: units
        .filter((unit) => unit.modelId)
        .map(({ _id, modelId, ...unit }) => ({
          unitId: String(_id),
          ...unit,
          modelId: String(modelId._id),
          model: {
            modelId: String(modelId._id),
            brand: modelId.brand,
            modelName: modelId.modelName,
            specs: modelId.specs,
          },
        })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load the laptop catalog." });
  }
});

// Public registration creates buyer accounts only. Admin and staff accounts are managed in /admin.
app.post("/api/auth/register", async (req, res) => {
  let createdUser = null;
  try {
    const { fullName, phone, email, password } = req.body || {};

    if (!fullName?.trim()) return res.status(400).json({ message: "Enter your full name." });
    if (!EMAIL_RE.test(email || "")) return res.status(400).json({ message: "Enter a valid email address." });
    if (!password || password.length < 8) return res.status(400).json({ message: "Use at least 8 characters for the password." });

    const cleanEmail = email.trim().toLowerCase();
    if (await User.exists({ email: cleanEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    createdUser = await User.create({
      fullName: fullName.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      email: cleanEmail,
      passwordHash,
      role: "buyer",
    });

    res.status(201).json(await sessionPayload(createdUser));
  } catch (error) {
    // Roll back the account if preparing its initial session fails.
    if (createdUser) await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    if (error?.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ message: "Enter a valid email address." });

    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.json({ message: "If an active account matches that email, reset instructions are available." });

    const token = randomBytes(32).toString("hex");
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await PasswordReset.updateMany(
      { userId: user._id, resetUsedAt: null },
      { $set: { resetUsedAt: new Date() } }
    );
    await PasswordReset.create({ userId: user._id, tokenHash, resetExpiresAt });

    const result = { message: "If an active account matches that email, reset instructions are available." };
    // Email delivery is not configured yet. Expose a link only in local development.
    if (process.env.NODE_ENV !== "production") {
      const origin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
      result.resetUrl = `${origin}/?resetToken=${token}`;
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not prepare a password reset. Please try again." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 8)
      return res.status(400).json({ message: "Use a valid reset link and a password with at least 8 characters." });

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const reset = await PasswordReset.findOneAndUpdate(
      { tokenHash, resetUsedAt: null, resetExpiresAt: { $gt: new Date() } },
      { $set: { resetUsedAt: new Date() } },
      { new: true }
    );
    if (!reset) return res.status(400).json({ message: "This reset link is invalid, expired, or already used." });

    const user = await User.findOneAndUpdate(
      { _id: reset.userId, isActive: true },
      { $set: { passwordHash: await bcrypt.hash(password, 10) } },
      { new: true }
    );
    if (!user) return res.status(400).json({ message: "This reset link is invalid, expired, or already used." });

    await PasswordReset.updateMany(
      { userId: user._id, resetUsedAt: null },
      { $set: { resetUsedAt: new Date() } }
    );
    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not reset the password. Please try again." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!EMAIL_RE.test(email || "") || !password) {
      return res.status(400).json({ message: "Enter your email and password." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) return res.status(401).json({ message: "Incorrect email or password." });
    if (!user.isActive) return res.status(403).json({ message: "This account has been deactivated." });

    res.json(await sessionPayload(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// Restores the session after a page refresh (also re-reads the verification status).
app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: publicUser(req.user), verification: await latestVerification(req.user._id) });
});

/* ---------- role-protected admin API ---------- */
app.get("/api/admin/data", requireAuth, requireStaff, async (req, res) => {
  try {
    const result = {};
    const collections = req.user.role === "admin"
      ? Object.keys(MODELS)
      : Object.keys(MODELS).filter((name) => !ADMIN_ONLY.has(name));
    await Promise.all(collections.map(async (name) => {
      let query = MODELS[name].find();
      const docs = await query.sort({ _id: -1 }).limit(1000).lean();
      result[name] = docs.map((doc) => {
        const record = serialize(name, doc);
        if (name === "units" && req.user.role !== "admin") delete record.costBasis;
        return record;
      });
    }));
    if (req.user.role !== "admin") {
      const batches = await Acquisition.find().select("invoiceNo").sort({ _id: -1 }).lean();
      result.acquisitions = batches.map(({ _id, invoiceNo }) => ({ acquisitionId: String(_id), invoiceNo }));
    }
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load admin data." });
  }
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName?.trim() || !EMAIL_RE.test(email || "") || !password || password.length < 8)
      return res.status(400).json({ message: "Provide a name, valid email, and password of at least 8 characters." });
    const doc = await User.create({
      fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone || "",
      passwordHash: await bcrypt.hash(password, 10), role: "staff", isActive: true,
    });
    await writeAudit(req, "create", "users", doc);
    res.status(201).json(serialize("users", doc));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "An account with this email already exists." });
    if (error?.name === "ValidationError") return res.status(400).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "Could not create staff account." });
  }
});

app.patch("/api/admin/users/:id/active", requireAuth, requireAdmin, async (req, res) => {
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "User not found." });
    if (["admin", "staff"].includes(doc.role) && String(doc._id) === String(req.user._id))
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    const before = doc.toObject();
    doc.isActive = Boolean(req.body?.isActive);
    await doc.save();
    await writeAudit(req, "update", "users", doc, before);
    res.json(serialize("users", doc));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update this account." });
  }
});

app.post("/api/admin/acquisitions/:id/split", requireAuth, requireAdmin, async (req, res) => {
  try {
    const acquisition = await Acquisition.findById(req.params.id);
    if (!acquisition) return res.status(404).json({ message: "Acquisition not found." });
    if (acquisition.acqStatus === "split") return res.status(409).json({ message: "This acquisition has already been split into units." });
    if (!acquisition.acqItems.length) return res.status(400).json({ message: "Add acquisition items before splitting." });
    const units = [];
    for (const item of acquisition.acqItems) {
      for (let i = 0; i < item.quantity; i += 1) {
        units.push(await Unit.create({
          serialNumber: `TBA-${acquisition._id.toString().slice(-6)}-${units.length + 1}`,
          modelId: item.modelId, acquisitionId: acquisition._id, costBasis: item.unitCost,
          conditionGrade: "C", unitStatus: "awaiting_inspection",
        }));
      }
    }
    const before = acquisition.toObject();
    acquisition.acqStatus = "split";
    await acquisition.save();
    await writeAudit(req, "update", "acquisitions", acquisition, before);
    for (const unit of units) await writeAudit(req, "create", "units", unit);
    res.status(201).json({ units: units.map((unit) => serialize("units", unit)) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not split this acquisition into units." });
  }
});

app.patch("/api/admin/orders/:id/returns/:index", requireAuth, requireStaff, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Only an admin can resolve returns." });
  try {
    const order = await Order.findById(req.params.id);
    const item = order?.returns?.[Number(req.params.index)];
    if (!item) return res.status(404).json({ message: "Return request not found." });
    const status = req.body?.returnStatus;
    const refund = Number(req.body?.refundAmount);
    if (!["approved", "rejected"].includes(status) || !Number.isFinite(refund) || refund < 0)
      return res.status(400).json({ message: "Choose approve or reject and enter a valid refund amount." });
    if (status === "rejected" && refund > 0) return res.status(400).json({ message: "Rejected returns cannot have a refund." });
    const sale = order.orderItems.find((orderItem) => String(orderItem.unitId) === String(item.returnUnitId));
    if (sale && refund > sale.priceAtSale) return res.status(400).json({ message: "Refund cannot exceed the item's sale price." });
    const before = order.toObject();
    item.returnStatus = status;
    item.refundAmount = refund;
    item.returnResolveAt = new Date();
    await order.save();
    await writeAudit(req, "update", "orders", order, before);
    res.json(serialize("orders", order));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not resolve the return." });
  }
});

app.patch("/api/admin/warranties/:id/claims/:index", requireAuth, requireStaff, async (req, res) => {
  try {
    const warranty = await Warranty.findById(req.params.id);
    const claim = warranty?.claims?.[Number(req.params.index)];
    if (!claim) return res.status(404).json({ message: "Warranty claim not found." });
    const status = req.body?.claimStatus;
    if (!status || !["filed", "in_review", "approved", "rejected", "resolved"].includes(status))
      return res.status(400).json({ message: "Choose a valid claim status." });
    const before = warranty.toObject();
    claim.claimStatus = status;
    claim.handledBy = req.user._id;
    claim.resolution = String(req.body?.resolution || "");
    if (["approved", "rejected", "resolved"].includes(status)) claim.claimResolvedAt = new Date();
    await warranty.save();
    await writeAudit(req, "update", "warranties", warranty, before);
    res.json(serialize("warranties", warranty));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update the warranty claim." });
  }
});

app.get("/api/admin/:collection", requireAuth, requireStaff, async (req, res, next) => {
  const { collection } = req.params;
  const Model = MODELS[collection];
  if (!Model) return next();
  if (ADMIN_ONLY.has(collection) && req.user.role !== "admin") return res.status(403).json({ message: "Admin access is required." });
  try {
    const docs = await Model.find().sort({ _id: -1 }).limit(1000);
    res.json(docs.map((doc) => {
      const record = serialize(collection, doc);
      if (collection === "units" && req.user.role !== "admin") delete record.costBasis;
      return record;
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load records." });
  }
});

app.post("/api/admin/:collection", requireAuth, requireStaff, async (req, res, next) => {
  const { collection } = req.params;
  const Model = MODELS[collection];
  if (!Model) return next();
  if (collection === "users") return res.status(403).json({ message: "Use the staff account controls." });
  if (ADMIN_ONLY.has(collection) && req.user.role !== "admin") return res.status(403).json({ message: "Admin access is required." });
  if (ADMIN_WRITE_ONLY.has(collection) && req.user.role !== "admin") return res.status(403).json({ message: "Only an admin can change the catalog." });
  if (["users", "orders", "student_verifications", "warranties", "audit_logs"].includes(collection))
    return res.status(403).json({ message: "This record cannot be created here." });
  try {
    const input = cleanInput(collection, req.body, req.user._id);
    if (collection === "units" && req.user.role !== "admin") {
      delete input.costBasis;
      const acquisition = await Acquisition.findById(input.acquisitionId);
      const matchingItem = acquisition?.acqItems.find((item) => String(item.modelId) === String(input.modelId));
      if (!matchingItem) return res.status(400).json({ message: "Choose an acquisition that contains this model." });
      input.costBasis = matchingItem.unitCost;
    }
    const doc = await Model.create(input);
    await writeAudit(req, "create", collection, doc);
    res.status(201).json(serialize(collection, doc));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "A record with the same unique value already exists." });
    if (error?.name === "ValidationError" || error?.name === "CastError") return res.status(400).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "Could not create record." });
  }
});

app.patch("/api/admin/:collection/:id", requireAuth, requireStaff, async (req, res, next) => {
  const { collection, id } = req.params;
  const Model = MODELS[collection];
  if (!Model) return next();
  if (collection === "users") return res.status(403).json({ message: "Use the activation control; roles and credentials cannot be changed here." });
  if (ADMIN_ONLY.has(collection) && req.user.role !== "admin") return res.status(403).json({ message: "Admin access is required." });
  if (ADMIN_WRITE_ONLY.has(collection) && req.user.role !== "admin") return res.status(403).json({ message: "Only an admin can change the catalog." });
  if (["audit_logs", "password_resets"].includes(collection)) return res.status(403).json({ message: "This record is read-only." });
  try {
    const doc = await Model.findById(id);
    if (!doc) return res.status(404).json({ message: "Record not found." });
    const before = doc.toObject();
    const input = cleanInput(collection, req.body, req.user._id);
    if (collection === "units" && req.user.role !== "admin") delete input.costBasis;
    if (collection === "users") {
      delete input.role;
      delete input.email;
      delete input.password;
      delete input.passwordHash;
    }
    if (collection === "orders") {
      const nextStatus = req.body?.orderStatus;
      const transitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["ready_for_pickup", "cancelled"],
        ready_for_pickup: ["picked_up", "cancelled"],
      };
      if (!transitions[doc.orderStatus]?.includes(nextStatus))
        return res.status(400).json({ message: "That order status change is not allowed from its current status." });
      doc.orderStatus = nextStatus;
      if (nextStatus === "picked_up") doc.pickedUpAt = new Date();
      doc.statusHistory.push({ newStatus: nextStatus, changedBy: req.user._id });
    } else if (collection === "student_verifications") {
      if (!["approved", "rejected"].includes(req.body?.verifStatus)) return res.status(400).json({ message: "Choose approve or reject." });
      doc.verifStatus = req.body.verifStatus;
      doc.verifiedBy = req.user._id;
      doc.verifiedAt = new Date();
      doc.remarks = String(req.body.remarks || "");
    } else if (collection === "warranties") {
      if (!Array.isArray(req.body?.claims)) return res.status(400).json({ message: "Provide updated claims." });
      doc.claims = req.body.claims.map((claim) => ({ ...claim, handledBy: req.user._id }));
    } else {
      doc.set(input);
    }
    await doc.save();
    await writeAudit(req, "update", collection, doc, before);
    res.json(serialize(collection, doc));
  } catch (error) {
    if (error?.name === "ValidationError" || error?.name === "CastError") return res.status(400).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "Could not update record." });
  }
});

app.delete("/api/admin/:collection/:id", requireAuth, requireAdmin, async (req, res, next) => {
  const { collection, id } = req.params;
  const Model = MODELS[collection];
  if (!Model) return next();
  if (["users", "orders", "student_verifications", "warranties", "audit_logs"].includes(collection))
    return res.status(403).json({ message: "This record cannot be deleted here." });
  try {
    const doc = await Model.findById(id);
    if (!doc) return res.status(404).json({ message: "Record not found." });
    const before = doc.toObject();
    await doc.deleteOne();
    await writeAudit(req, "delete", collection, null, before);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not delete record." });
  }
});

/* ---------- start ---------- */

const port = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing. Add it to server/.env.");
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB:", mongoose.connection.name);
    app.listen(port, () => console.log(`API running on http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
