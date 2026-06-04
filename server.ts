import express from "express";
import path from "path";
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

      const key = process.env.GEMINI_API_KEY;
      if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
        return res.status(400).json({ 
          error: "Kunci API Gemini tidak dikonfigurasi. Sila tambahkan GEMINI_API_KEY yang sah melalui menu Settings > Secrets di AI Studio."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = "Extract tender details from this document. Return in JSON format. Use these keys: tenderNo, title, state, office, closingDate (YYYY-MM-DD), closingTime, closingVenue, briefingDate (YYYY-MM-DD), briefingTime, briefingVenue, visitDate (YYYY-MM-DD), visitVenue, docStartDate (YYYY-MM-DD), docEndDate (YYYY-MM-DD), docVenue, publishedDate (YYYY-MM-DD), licenses (object with booleans for cidb, stb, mof, tcc, pukonsa, kuhean).";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
      let errMsg = error.message || "Failed to analyze document";
      if (typeof errMsg === "string" && (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key"))) {
        errMsg = "Kunci API Gemini tidak sah atau telah dihadkan. Sila pastikan anda telah memasukkan GEMINI_API_KEY yang betul di dalam menu Settings > Secrets di AI Studio.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // API Route for AI Chat Assistant
  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Missing message" });
      }

      const key = process.env.GEMINI_API_KEY;
      if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
        return res.status(400).json({ 
          error: "Kunci API Gemini tidak dikonfigurasi. Sila tambahkan GEMINI_API_KEY yang sah melalui menu Settings > Secrets di AI Studio."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `You are an AI assistant for the SMART LOG PEROLEHAN system. 
Your goal is to answer questions about the Tender Management System of RISDA. 
Key info:
- This system is for site briefing attendance registration for RISDA tenders.
- Roles: Admin (System Admin), Penginput (Staff), Pelulus (Approver), Pelawat (Visitors/Contractors).
- Features: Ads management, Attendance tracking, Role management, Reports.
- Contractors use the system to register their presence at site briefings via QR or manual entry.
Answer in Bahasa Melayu properly. Be professional, humble, helpful, and concise.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: message,
        config: {
          systemInstruction,
        }
      });

      res.json({ text: response.text || "Maaf, saya tidak dapat menjawab soalan itu buat masa sekarang." });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      let errMsg = error.message || "Failed to process chat message";
      if (typeof errMsg === "string" && (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key"))) {
        errMsg = "Kunci API Gemini tidak sah atau telah dihadkan. Sila pastikan anda telah memasukkan GEMINI_API_KEY yang betul di dalam menu Settings > Secrets di AI Studio.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // Expose the PUBLIC directory as static files for both uppercase and lowercase paths
  app.use("/PUBLIC", express.static(path.join(process.cwd(), "PUBLIC")));
  app.use("/public", express.static(path.join(process.cwd(), "PUBLIC")));
  app.use("/QR%20KOD", express.static(path.join(process.cwd(), "QR KOD")));
  app.use("/QR KOD", express.static(path.join(process.cwd(), "QR KOD")));

  // Route to get the QR code
  app.get("/api/qr-code.png", async (req, res) => {
    try {
      const qrcode = await import("qrcode");
      const adId = req.query.adId as string;
      const text = req.query.text as string;

      // Determine target content for the QR code
      let qrContent = "";
      if (text) {
        qrContent = text;
      } else if (adId) {
        // Construct unique URL for direct registration of the ad
        const origin = req.query.origin as string;
        if (origin) {
          // Remove any trailing slashes just to be clean
          const cleanOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
          qrContent = `${cleanOrigin}/?adId=${adId}`;
        } else {
          const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
          const host = req.get('host');
          qrContent = `${protocol}://${host}/?adId=${adId}`;
        }
      }

      if (qrContent) {
        res.setHeader('Content-Type', 'image/png');
        // Generate and stream dynamic high quality QR code
        await qrcode.default.toFileStream(res, qrContent, {
          type: 'png',
          width: 400,
          margin: 2,
          color: {
            dark: '#0f172a', // Deep slate/black color
            light: '#ffffff'
          }
        });
        return;
      }

      // Fallback if no specific dynamic content is requested
      const fs = await import("fs");
      const qrKodPath = path.join(process.cwd(), "QR KOD", "qr.png");
      const publicQrPath = path.join(process.cwd(), "PUBLIC", "qr.png");
      
      if (fs.existsSync(qrKodPath) && fs.statSync(qrKodPath).size > 0) {
        res.setHeader('Content-Type', 'image/png');
        return fs.createReadStream(qrKodPath).pipe(res);
      } else if (fs.existsSync(publicQrPath) && fs.statSync(publicQrPath).size > 0) {
        res.setHeader('Content-Type', 'image/png');
        return fs.createReadStream(publicQrPath).pipe(res);
      }

      // Final fallback: generate a QR code pointing to the portal homepage
      const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = req.get('host');
      const homepageUrl = `${protocol}://${host}/`;
      res.setHeader('Content-Type', 'image/png');
      await qrcode.default.toFileStream(res, homepageUrl, {
        type: 'png',
        width: 400,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error("QR Code Serve Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Proxy for Logo with local first fallback
  app.get("/api/logo", async (req, res) => {
    try {
      const fs = await import("fs");
      const localLogoPath = path.join(process.cwd(), "PUBLIC", "intrologo_RISDA.png");
      if (fs.existsSync(localLogoPath) && fs.statSync(localLogoPath).size > 0) {
        res.setHeader('Content-Type', 'image/png');
        return fs.createReadStream(localLogoPath).pipe(res);
      }

      // Online fallback if local file does not exist or is empty
      const logoUrl = 'https://risdaagro.com.my/wp-content/uploads/2021/04/Logo-RISDA-1.png';
      const response = await fetch(logoUrl);
      
      if (!response.ok) {
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
