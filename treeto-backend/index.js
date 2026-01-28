const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

/**
 * 1. PAYLOAD SIZE FIX
 * Increase limit to 50MB to handle large audio chunks
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 8080;

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: "Too many requests. Please wait." }
});
app.use('/api/', limiter);

// --- ENDPOINTS ---

/**
 * NEW ENDPOINT: Deepgram Token Generator
 * Generates temporary JWT tokens (30-second TTL) for secure client access
 * Uses the 'auth/grant' endpoint which doesn't require a Project ID.
 */
app.post('/api/deepgram/token', async (req, res) => {
  try {
    // Validate API key exists
    if (!process.env.DEEPGRAM_API_KEY) {
      console.error("[Deepgram Token] ERROR: DEEPGRAM_API_KEY is not set in environment variables");
      return res.status(500).json({ 
        error: 'Failed to generate token',
        details: 'DEEPGRAM_API_KEY not configured on server'
      });
    }

    console.log("[Deepgram Token] Requesting token from Deepgram API...");
    
    const response = await axios.post(
      'https://api.deepgram.com/v1/auth/grant',
      {},
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("[Deepgram Token] Token generated successfully");
    
    // Returns: { access_token: "...", expires_in: 30 }
    res.json(response.data);

  } catch (err) {
    console.error("[Deepgram Token] Error:", err.message);
    if (err.response) {
      console.error("[Deepgram Token] API Response:", err.response.status, JSON.stringify(err.response.data));
    }
    if (err.code) {
      console.error("[Deepgram Token] Error Code:", err.code);
    }
    res.status(err.response?.status || 500).json({ 
      error: 'Failed to generate token',
      message: err.message 
    });
  }
});

/**
 * TRANSCRIPTION PROXY (Standard / File Upload)
 */
app.post('/api/transcribe', async (req, res) => {
  try {
    let deepgramBody = req.body;
    let deepgramHeaders = {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json' 
    };

    if (req.body.audio) {
      deepgramBody = Buffer.from(req.body.audio, 'base64');
      deepgramHeaders['Content-Type'] = 'audio/wav'; 
    }

    const response = await axios.post(
      'https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&model=nova-2', 
      deepgramBody, 
      { headers: deepgramHeaders }
    );
    
    res.json(response.data);
  } catch (err) {
    console.error("Deepgram Error:", err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Transcription failed" });
  }
});

/**
 * AI PROXY (Gemini)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      req.body
    );
    res.json(response.data);
  } catch (err) {
    console.error("Gemini Error:", err.message);
    res.status(err.response?.status || 500).json(err.response?.data || { error: "AI processing failed" });
  }
});

/**
 * CONFIGURATION
 */
app.get('/api/config', (req, res) => {
  res.json({
    status: "online",
    region: "asia-south1",
    features: { transcription: true, ai: true }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Treeto Server live on port ${PORT}`);
});