const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config();

const config = require('./config');
const Visitor = require('./models/Visitor');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// SECURITY & MIDDLEWARE
// ==========================================

// Helmet sets secure HTTP headers.
// Since we are loading this chatbot as an iframe, we need to allow frame embedding.
app.use(helmet({
  contentSecurityPolicy: false, // Disabling strict CSP to allow flexible development and resource loading
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  frameguard: false // Essential: allows embedding the chat page in an iframe on user sites
}));

// Enable Cross-Origin Resource Sharing (CORS) so external sites can load widget resources and make API calls
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Set up API rate limiting to protect backend resources
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);
