import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import "./Login.css"; // Reusing the same CSS file for styling

// Import your Supabase client
import { supabase } from "../supabaseClient";

export default function Signup() {
  // Set default email value to "Email address" and password remains blank
  const [email, setEmail] = useState("Email address");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();

  async function handleSignup() {
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        console.log("Signed up user:", data.user);
        // Redirect to /dashboard (or a welcome page) after signup
        setLocation("/dashboard");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      console.error("Signup error:", err);
    }
  }

  return (
    <div className="homeRoot">
      {/* You can reuse the left panel if desired or adjust accordingly */}
      <div className="homeRightSection">
        <div className="loginContainer">
          <h2>Create your account</h2>

          {errorMsg && <p className="errorBanner">{errorMsg}</p>}

          <label htmlFor="emailInput">Email</label>
          <input
            id="emailInput"
            type="text"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="passwordInput">Password</label>
          <input
            id="passwordInput"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="loginBtn" onClick={handleSignup}>
            Sign Up
          </button>

          <p className="newUser">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
