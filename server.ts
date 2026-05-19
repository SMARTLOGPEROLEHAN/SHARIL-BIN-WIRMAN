import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for Gemini Analysis
  app.post("/api/analyze-tender", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      
      if (!base64Data) {
        return res.status(400).json({ error: "Missing file data" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = "Extract tender details from this document. Return in JSON format. Use these keys: tenderNo, title, state, office, closingDate (YYYY-MM-DD), closingTime, closingVenue, briefingDate (YYYY-MM-DD), briefingTime, briefingVenue, visitDate (YYYY-MM-DD), visitVenue, docStartDate (YYYY-MM-DD), docEndDate (YYYY-MM-DD), docVenue, publishedDate (YYYY-MM-DD), licenses (object with booleans for cidb, stb, mof, tcc, pukonsa, kuhean).";

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ]
      });

      let text = response.text || "";
      
      // Clean up JSON response if it's wrapped in markdown blocks
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].trim();
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze document" });
    }
  });

  // Proxy for Logo to avoid CORS
  app.get("/api/logo", async (req, res) => {
    try {
      const logoUrl = 'https://www.risda.gov.my/images/logo_risda.png';
      const response = await fetch(logoUrl);
      
      if (!response.ok) {
        // Fallback to Wikipedia logo if primary fails
        const fallbackUrl = 'https://upload.wikimedia.org/wikipedia/ms/7/7b/Logo_RISDA.png';
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          res.setHeader('Content-Type', 'image/png');
          return fallbackRes.body.pipe(res);
        }
        return res.status(404).send('Logo not found');
      }

      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png');
      response.body.pipe(res);
    } catch (error) {
      console.error("Logo Proxy Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
