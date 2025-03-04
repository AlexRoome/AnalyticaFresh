import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import "./Login.css";

// Import the shared left panel component
import LeftPanel from "../components/LeftPanel";

// Import your Supabase client
import { supabase } from "../supabaseClient";

export default function Login() {
  // Set default email value to "Email address" and password remains blank
  const [email, setEmail] = useState("Email address");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Wouter location hook
  const [, setLocation] = useLocation();

  async function handleLogin() {
    setErrorMsg(""); // Clear any previous error
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        console.log("Logged in user:", data.user);
        // Redirect to /dashboard on success
        setLocation("/dashboard");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      console.error("Login error:", err);
    }
  }

  return (
    <div className="homeRoot">
      {/* Left panel */}
      <LeftPanel />

      {/* Right panel */}
      <div className="homeRightSection">
        <div className="loginContainer">
          <h2>Log in to your account</h2>

          {/* Only show an error if one exists */}
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

          <button className="loginBtn" onClick={handleLogin}>
            Log In
          </button>

          <div className="socialButtons">
            <button>Continue with Google</button>
          </div>

          <p className="newUser">
            New to Analytica? <Link href="/signup">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
