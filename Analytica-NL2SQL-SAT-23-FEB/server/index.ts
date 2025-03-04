import express, { type Request, type Response, type NextFunction } from "express";
import fetch from "node-fetch"; // or built-in fetch if on Node 18+
import http from "http";        // We need to create an http.Server
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors"; // Add CORS support

// -----------------------------
// ADD THESE LINES FOR SUPABASE
// -----------------------------
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service role key
const supabase = createClient(supabaseUrl!, supabaseKey!);

// -----------------------------------
// Express App + Existing Middleware
// -----------------------------------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS middleware to allow requests from any origin during development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// --------------------------------------------------
// Logging Middleware (unchanged)
// --------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });
  next();
});

// --------------------------------------------------
// Health Check Endpoint for Troubleshooting
// --------------------------------------------------
app.get("/health", (req: Request, res: Response) => {
  const healthInfo = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: app.get("env"),
    openai_key_configured: !!process.env.VITE_OPENAI_API_KEY,
    supabase_configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY
  };
  
  console.log("Health check requested:", healthInfo);
  res.status(200).json(healthInfo);
});

// --------------------------------------------------
// OpenAI Proxy Route (unchanged)
// --------------------------------------------------
app.post("/api/openai", async (req: Request, res: Response) => {
  try {
    const { model, messages, functions, function_call } = req.body;
    
    // Log the request for debugging
    console.log("OpenAI API request received:", { model, messages: messages.length });
    
    // Make sure we have the API key
    if (!process.env.VITE_OPENAI_API_KEY) {
      console.error("Missing OpenAI API key in environment variables");
      return res.status(500).json({ error: "OpenAI API key not configured." });
    }

    // Call the OpenAI API from the server side
    console.log("Calling OpenAI API with key:", process.env.VITE_OPENAI_API_KEY.substring(0, 10) + "...");
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, functions, function_call }),
    });

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text();
      console.error("OpenAI API error:", openAiResponse.status, errorText);
      return res.status(openAiResponse.status).json({ 
        error: `OpenAI API error: ${openAiResponse.status}`,
        details: errorText
      });
    }

    const data = await openAiResponse.json();
    return res.json(data);
  } catch (error) {
    console.error("Error proxying OpenAI request:", error);
    return res.status(500).json({ error: "Failed to call OpenAI." });
  }
});

// --------------------------------------------------
// NEW: /api/schema Route
// --------------------------------------------------
import { getSchema } from "./schema";
app.get("/api/schema", getSchema);

// --------------------------------------------------
// Error handling middleware (unchanged)
// --------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${message}`);
  res.status(status).json({ message });
});

// --------------------------------------------------
// Development vs Production Setup (unchanged)
// --------------------------------------------------
(async () => {
  try {
    const httpServer = http.createServer(app);

    if (app.get("env") === "development") {
      await setupVite(app, httpServer);
      startServer(httpServer);
    } else {
      serveStatic(app);
      startServer(httpServer);
    }
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
})();

// --------------------------------------------------
// Helper: Start the server (unchanged)
// --------------------------------------------------
function startServer(server: http.Server) {
  const PORT = parseInt(process.env.PORT || "3000", 10);
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running on port ${PORT}`);
  });
}
