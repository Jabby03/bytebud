import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, School, StudentVerification } from "./models.js";

dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

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

// Matches the school email's domain against Schools.emailDomains (subdomains allowed).
async function findSchoolByEmail(email) {
  const domain = email.split("@")[1];
  const schools = await School.find({ status: "active" });
  return schools.find((s) => s.emailDomains.some((d) => domain === d || domain.endsWith(`.${d}`))) || null;
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

/* ---------- routes ---------- */

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Register: always creates a buyer. Student sign-ups also create a pending verification.
app.post("/api/auth/register", async (req, res) => {
  let createdUser = null;
  try {
    const { fullName, email, password, isStudent, schoolEmail } = req.body || {};

    if (!fullName?.trim()) return res.status(400).json({ message: "Enter your full name." });
    if (!EMAIL_RE.test(email || "")) return res.status(400).json({ message: "Enter a valid email address." });
    if (!password || password.length < 8) return res.status(400).json({ message: "Use at least 8 characters for the password." });

    const cleanEmail = email.trim().toLowerCase();
    if (await User.exists({ email: cleanEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    let school = null;
    let cleanSchoolEmail = null;
    if (isStudent) {
      cleanSchoolEmail = (schoolEmail || "").trim().toLowerCase();
      if (!EMAIL_RE.test(cleanSchoolEmail)) {
        return res.status(400).json({ message: "Enter a valid school email address." });
      }
      school = await findSchoolByEmail(cleanSchoolEmail);
      if (!school) {
        return res.status(400).json({ message: "That school email domain is not a partner school." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    createdUser = await User.create({ fullName: fullName.trim(), email: cleanEmail, passwordHash, role: "buyer" });

    if (school) {
      await StudentVerification.create({
        userId: createdUser._id,
        schoolId: school._id,
        schoolEmail: cleanSchoolEmail,
        verifStatus: "pending",
      });
    }

    res.status(201).json(await sessionPayload(createdUser));
  } catch (error) {
    // Roll back the user if the verification record could not be created.
    if (createdUser) await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    if (error?.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
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
