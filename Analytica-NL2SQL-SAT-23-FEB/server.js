// server.js (root level)

import express from "express";
import fetch from "node-fetch"; // If you’re on older Node, use 'node-fetch'
import cors from "cors";        // Typically needed so your React dev server can hit this endpoint

const app = express();
app.use(cors());
app.use(express.json());

// Proxy route to OpenAI
app.post("/api/openai", async (req, res) => {
  try {
    // 1) Grab info from client (like model, messages, etc.)
    const { model, messages, functions, function_call } = req.body;

    // 2) Call OpenAI from the server
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VITE_OPENAI_API_KEY}`, 
      },
      body: JSON.stringify({
        model,
        messages,
        functions,
        function_call,
      }),
    });

    // 3) Return the JSON from OpenAI to the client
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("Error calling OpenAI:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
