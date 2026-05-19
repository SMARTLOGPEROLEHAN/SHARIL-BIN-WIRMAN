import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";

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
        model: "gemini-3-flash-preview",
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
      
      // Better JSON cleaning
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("JSON Parse Error. Raw text:", text);
        res.status(500).json({ error: "Failed to parse AI response as JSON" });
      }
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze document" });
    }
  });

  // Proxy for Logo to avoid CORS
  app.get("/api/logo", async (req, res) => {
    try {
      // 1. Check if local logo exists in public folder
      const localLogoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(localLogoPath) && fs.statSync(localLogoPath).size > 0) {
        res.setHeader('Content-Type', 'image/png');
        return fs.createReadStream(localLogoPath).pipe(res);
      }

      // 2. Fallback to Gold Logo URL
      const logoUrl = 'https://risdaagro.com.my/wp-content/uploads/2021/04/Logo-RISDA-1.png';
      const response = await fetch(logoUrl);
      
      if (!response.ok) {
        // 3. Fallback to official site logo
        const fallbackUrl = 'https://www.risda.gov.my/images/logo_risda.png';
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
