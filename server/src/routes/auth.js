const express = require("express");
const multer = require("multer");
const { supabase, supabaseAdmin } = require("../config/supabase");
const { Resend } = require("resend");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
});

// In-memory OTP store (use Redis in production)
const otpStore = new Map();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /auth/signup - Step 1: Send OTP
router.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName)
    return res.status(400).json({ error: "All fields required" });

  // Check if username is taken
  const { data: existingName } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("display_name", displayName)
    .single();

  if (existingName) return res.status(400).json({ error: "Username already taken" });

  // Check if email already registered
  const { data: existingEmail } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingEmail) return res.status(400).json({ error: "Email already registered" });

  const otp = generateOtp();
  otpStore.set(email, { otp, password, displayName, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    await resend.emails.send({
      from: `Chat App <${process.env.RESEND_FROM_EMAIL}>`,
      to: email,
      subject: "Your verification code",
      html: `
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
          <h2 style="color:#00d4aa;">Chat App</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing:8px;text-align:center;background:#f5f5f5;padding:16px;border-radius:8px;">${otp}</h1>
          <p style="color:#888;font-size:14px;">This code expires in 10 minutes.</p>
        </div>
      `,
    });
    res.json({ needsVerification: true });
  } catch (err) {
    otpStore.delete(email);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

// POST /auth/verify-otp - Step 2: Verify OTP and create account
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Email and OTP required" });

  const stored = otpStore.get(email);
  if (!stored) return res.status(400).json({ error: "No pending verification. Please sign up again." });
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP expired. Please sign up again." });
  }
  if (stored.otp !== otp) return res.status(400).json({ error: "Invalid code" });

  // OTP valid — create the actual account
  const { data, error } = await supabase.auth.signUp({
    email,
    password: stored.password,
    options: { data: { display_name: stored.displayName } },
  });

  if (error) {
    otpStore.delete(email);
    return res.status(400).json({ error: error.message });
  }

  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    display_name: stored.displayName,
  });

  otpStore.delete(email);
  res.json({ user: data.user, session: data.session });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password)
    return res.status(400).json({ error: "Email/username and password required" });

  let email = identifier;

  // If not an email, look up the email by username
  if (!identifier.includes("@")) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .ilike("display_name", identifier)
      .single();

    if (!profile) return res.status(400).json({ error: "User not found" });
    email = profile.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// GET /auth/me (protected)
router.get("/me", authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: "Profile not found" });
  res.json(data);
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ message: "Logged out" });
});

// PUT /auth/profile - Update profile (display name, bio, avatar)
router.put("/profile", authMiddleware, (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  const { displayName, bio } = req.body;
  const updates = {};

  if (displayName !== undefined) {
    const name = displayName.trim();
    if (!name) return res.status(400).json({ error: "Display name cannot be empty" });

    // Get current profile to check cooldown
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, display_name_changed_at")
      .eq("id", req.user.id)
      .single();

    // Only enforce cooldown if the name is actually changing
    if (currentProfile && name.toLowerCase() !== currentProfile.display_name?.toLowerCase()) {
      if (currentProfile.display_name_changed_at) {
        const lastChanged = new Date(currentProfile.display_name_changed_at);
        const daysSince = (Date.now() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          const daysLeft = Math.ceil(7 - daysSince);
          return res.status(400).json({ error: `You can change your username again in ${daysLeft} day${daysLeft > 1 ? "s" : ""}` });
        }
      }

      // Check uniqueness (excluding self)
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("display_name", name)
        .neq("id", req.user.id)
        .single();

      if (existing) return res.status(400).json({ error: "Username already taken" });
      updates.display_name = name;
      updates.display_name_changed_at = new Date().toISOString();
    }
  }

  if (bio !== undefined) updates.bio = bio.trim().slice(0, 150);

  // Handle avatar upload
  if (req.file) {
    const ext = req.file.originalname.split(".").pop();
    const filePath = `${req.user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadErr) return res.status(500).json({ error: uploadErr.message });

    const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);
    updates.avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Nothing to update" });

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", req.user.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
