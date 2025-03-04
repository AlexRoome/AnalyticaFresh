import type { Express } from "express";
import { createServer, type Server } from "http";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Calculate endpoint with proper error handling
  app.post('/api/calculate', async (req, res) => {
    try {
      if (!req.body || !req.body.expression) {
        return res.status(400).json({ error: 'Missing expression in request body' });
      }

      // Execute the calculation (simplified for now)
      const result = eval(req.body.expression);
      res.json({ result });
    } catch (error) {
      console.error('Calculation error:', error);
      res.status(500).json({ error: 'Calculation failed' });
    }
  });

  // Data endpoints with proper error handling
  app.get('/api/data', (_req, res) => {
    try {
      res.json({ data: {} }); // Return empty data initially
    } catch (error) {
      console.error('Data fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  app.post('/api/data', (req, res) => {
    try {
      // Save data (in-memory for this example)
      res.json({ success: true });
    } catch (error) {
      console.error('Data save error:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  return httpServer;
}