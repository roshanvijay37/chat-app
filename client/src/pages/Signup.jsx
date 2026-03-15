import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("signup");
  const [error, setError] = useState("");
  const { signup, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    const res = await signup(email, password, displayName);
    if (res.error) return setError(res.error);
    if (res.needsVerification) {
      setStep("otp");
    } else {
      navigate("/");
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    const res = await verifyOtp(email, otp);
    if (res.error) return setError(res.error);
    navigate("/");
  };

  if (step === "otp") {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Verify Email</h1>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1rem" }}>
            We sent a 6-digit code to {email}
          </p>
          {error && <p className="error">{error}</p>}
          <form onSubmit={handleVerify}>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              required
              style={{ textAlign: "center", fontSize: "1.3rem", letterSpacing: "0.5rem" }}
            />
            <button type="submit">Verify</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit">Sign Up</button>
        </form>
        <p>
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
