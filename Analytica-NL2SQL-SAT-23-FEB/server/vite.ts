// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Sets up Vite dev middleware on the Express 'app'.
 *
 * IMPORTANT: now returns the same Express 'app'
 * so you can call 'app.listen(...)' in your index.ts without error.
 */
export async function setupVite(app: Express, server: Server): Promise<Express> {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // This logic is from your code, customizing TypeScript logs, etc.
        if (msg.includes("[TypeScript] Found 0 errors. Watching for file changes")) {
          log("no errors found", "tsc");
          return;
        }
        if (msg.includes("[TypeScript] ")) {
          const [errors, summary] = msg.split("[TypeScript] ", 2);
          log(`${summary} ${errors}\u001b[0m`, "tsc");
          return;
        } else {
          viteLogger.error(msg, options);
          process.exit(1);
        }
      },
    },
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });

  // Attach Vite middleware
  app.use(vite.middlewares);

  // Serve your /public folder in dev
  app.use(express.static(path.resolve(__dirname, "..", "public")));

  // Fallback: transform index.html via Vite
  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  // Return the Express app (no longer undefined)
  return app;
}

/**
 * Production mode: serve static files
 * Also returns 'app' so you can do app.listen(...) later.
 */
export function serveStatic(app: Express): Express {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Build the client first.`
    );
  }

  // Serve built assets
  app.use(express.static(distPath));

  // Fallback: serve index.html
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  return app;
}
