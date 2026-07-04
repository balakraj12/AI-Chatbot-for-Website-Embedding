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

