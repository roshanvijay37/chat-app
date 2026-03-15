const express = require("express");
const { supabase, supabaseAdmin } = require("../config/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// POST /auth/signup
router.post("/signup", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName)
    return res.status(400).json({ error: "All fields required" });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) return res.status(400).json({ error: error.message });

  // Create profile row
  await supabaseAdmin.from("profiles").upsert({
    id: data.user.id,
    email,
    display_name: displayName,
  });

  res.json({ user: data.user, session: data.session, needsVerification: !data.session });
});

// POST /auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ error: "Email and OTP required" });

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "signup",
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

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

module.exports = router;
