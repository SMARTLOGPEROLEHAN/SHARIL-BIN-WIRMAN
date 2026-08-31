import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin SDK
  let hasAdminSdk = false;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let projectId = "gen-lang-client-0995842973";
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.projectId) {
        projectId = config.projectId;
      }
    }
    
    if (getApps().length === 0) {
      initializeApp({
        projectId: projectId
      });
    }
    hasAdminSdk = true;
    console.log("Firebase Admin SDK initialized successfully for project:", projectId);
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
  }

  app.use(express.json({ limit: '10mb' }));

  // API Route for sending automated emails
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, text, html, attachments } = req.body;
      if (!to || !subject || (!text && !html)) {
        return res.status(400).json({ error: "Sila berikan parameter email yang lengkap (to, subject, text dan/atau html)" });
      }

      const host = process.env.SMTP_HOST;
      const port = process.env.SMTP_PORT;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const from = process.env.SMTP_FROM || user;

      if (!host || !user || !pass) {
        console.warn("SMTP credentials are not fully configured in Secrets. Email cannot be sent via direct SMTP.");
        return res.status(501).json({ 
          error: "Konfigurasi SMTP tidak lengkap. Sila tambahkan SMTP_HOST, SMTP_USER, dan SMTP_PASS di bahagian Secrets di AI Studio."
        });
      }

      const transporter = nodemailer.createTransport({
        host,
        port: port ? parseInt(port, 10) : 587,
        secure: port === "465", // Use SSL for port 465, TLS/secure=false for others
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: false // Avoid issues with self-signed certs
        }
      });

      const mailOptions: any = {
        from: from || `"Sistem Pengurusan Organisasi" <${user}>`,
        to,
        subject,
        text,
        html: html || text.replace(/\n/g, "<br/>"),
      };

      if (attachments && Array.isArray(attachments)) {
        mailOptions.attachments = attachments.map((att: any) => ({
          filename: att.filename,
          content: Buffer.from(att.content, 'base64'),
          contentType: att.contentType || 'application/pdf'
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully: ", info.messageId);
      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error("Failed to send email via SMTP:", error);
      res.status(500).json({ error: error.message || "Gagal menghantar e-mel melalui SMTP." });
    }
  });

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

  // API Route for Auto-extracting License Expiry Date using Gemini
  app.post("/api/analyze-license", async (req, res) => {
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

      const prompt = "Extract the license/certificate expiry date (Tarikh Tamat Tempoh / Sah Sehingga / Tarikh Akhir / Valid Until) from this document. Search carefully for fields indicating 'Tamat', 'Hingga', 'Expiry', 'Expired', 'Valid Until', 'Sah Sehingga', 'Sijil tamat pada', 'Tempoh Kelulusan', 'Tarikh Habis'. If you find multiple dates, look for the one clearly associated with the expiry, validity end, or end of registration of the company/license. Return a JSON object in this format: { \"expiryDate\": \"YYYY-MM-DD\" }. If no valid license expiry date can be confidently found, return { \"expiryDate\": null }.";

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
      
      // Clean markdown blocks
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      try {
        const parsedData = JSON.parse(text);
        res.json(parsedData);
      } catch (parseError) {
        console.error("JSON Parse Error. Raw text:", text);
        res.status(500).json({ error: "Failed to parse AI response as JSON" });
      }
    } catch (error: any) {
      console.error("License Analysis Error:", error);
      let errMsg = error.message || "Failed to analyze document";
      if (typeof errMsg === "string" && (errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key"))) {
        errMsg = "Kunci API Gemini tidak sah. Sila pastikan GEMINI_API_KEY betul.";
      }
      res.status(500).json({ error: errMsg });
    }
  });

  // API Route for Admin to completely delete a Firebase Auth Account
  app.post("/api/delete-user", async (req, res) => {
    try {
      const { uid, email } = req.body;
      
      if (!uid && !email) {
        return res.status(400).json({ error: "Sila berikan UID atau Email kakitangan yang ingin dipadam." });
      }

      if (!hasAdminSdk) {
        return res.status(500).json({ 
          error: "Sistem Firebase Admin tidak aktif. Tidak dapat memadam akaun auth secara automatik." 
        });
      }

      let deletedFromAuth = false;
      let errorMsg = "";

      // 1. Try to delete by UID if provided
      if (uid) {
        try {
          await getAuth().deleteUser(uid);
          deletedFromAuth = true;
          console.log(`Successfully deleted Firebase Auth user with UID: ${uid}`);
        } catch (authError: any) {
          console.warn(`Could not delete user by UID ${uid}:`, authError.message);
          errorMsg = authError.message || "";
        }
      }

      // 2. If UID deletion failed or wasn't provided, try by Email
      if (!deletedFromAuth && email) {
        try {
          const userRecord = await getAuth().getUserByEmail(email.trim());
          if (userRecord && userRecord.uid) {
            await getAuth().deleteUser(userRecord.uid);
            deletedFromAuth = true;
            console.log(`Successfully deleted Firebase Auth user with Email: ${email} (UID: ${userRecord.uid})`);
          }
        } catch (authError: any) {
          console.warn(`Could not delete user by Email ${email}:`, authError.message);
          if (!errorMsg) errorMsg = authError.message || "";
        }
      }

      if (deletedFromAuth) {
        res.json({ success: true, message: "Akaun Authentication Firebase berjaya dipadam sepenuhnya." });
      } else {
        // If the user does not exist in Firebase Auth (e.g. they only exist in Firestore database but never registered with Auth),
        // we can still return success because their Auth account doesn't exist anyway.
        const isUserNotFound = errorMsg.toLowerCase().includes("user-not-found") || 
                              errorMsg.toLowerCase().includes("no user record found") || 
                              errorMsg.toLowerCase().includes("auth/user-not-found");
                              
        if (isUserNotFound) {
          res.json({ success: true, message: "Akaun Authentication Firebase tiada atau telah dipadam." });
        } else {
          res.status(500).json({ 
            error: `Gagal memadam akaun daripada Firebase Authentication: ${errorMsg}. Sila pastikan kredibiliti pentadbiran Firebase sah.`
          });
        }
      }
    } catch (error: any) {
      console.error("Firebase Auth Deletion Error:", error);
      res.status(500).json({ error: error.message || "Gagal memadam akaun Authentication Firebase." });
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
      const possiblePaths = [
        path.join(process.cwd(), "public", "intrologo_RISDA.png"),
        path.join(process.cwd(), "PUBLIC", "intrologo_RISDA.png"),
        path.join(process.cwd(), "public", "PUBLIC", "intrologo_RISDA.png"),
        path.join(process.cwd(), "dist", "public", "intrologo_RISDA.png"),
        path.join(process.cwd(), "dist", "PUBLIC", "intrologo_RISDA.png")
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.statSync(p).size > 0) {
          res.setHeader('Content-Type', 'image/png');
          return fs.createReadStream(p).pipe(res);
        }
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
