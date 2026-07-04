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

// Serve static assets from the public directory (for hosting widget.js)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Groq API Client if key is available
const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  console.warn('WARNING: GROQ_API_KEY is not defined in the environment. Chatbot requests will fail.');
}
const groq = new Groq({ apiKey: groqApiKey || 'placeholder_key' });

// Connect to MongoDB Database
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/varta_assistant';
mongoose.connect(mongoUri)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection failure:', err));

  // ==========================================
// WIDGET ENDPOINTS (VISITOR ACTIONS)
// ==========================================

/**
 * @route   POST /api/widget/onboard
 * @desc    Onboard a first-time visitor, saving their name, profession, and goal.
 *          Creates a new visitor profile and an active conversation.
 */
app.post('/api/widget/onboard', async (req, res) => {
  const { name, profession, goal } = req.body;
  console.log(`[WIDGET] [ONBOARD] Request received to onboard visitor: "${name}" (${profession}) | Goal: "${goal}"`);

  try {
    if (!name || !profession || !goal) {
      console.warn(`[WIDGET] [ONBOARD] [BAD REQUEST] Missing onboarding fields.`);
      return res.status(400).json({ error: 'Name, profession, and goal are all required.' });
    }

     // Save the new visitor profile
    const newVisitor = new Visitor({ name, profession, goal });
    const savedVisitor = await newVisitor.save();

     // Create a new conversation associated with this visitor
    const newConversation = new Conversation({ visitorId: savedVisitor._id });
    const savedConversation = await newConversation.save();

     console.log(`[WIDGET] [ONBOARD] [SUCCESS] Onboarded "${savedVisitor.name}". Created Conversation ID: ${savedConversation._id}`);

    return res.status(201).json({
      message: 'Onboarding completed successfully.',
      visitorId: savedVisitor._id,
      conversationId: savedConversation._id,
      visitorName: savedVisitor.name
    });

     } catch (error) {
    console.error('[WIDGET] [ONBOARD] [ERROR] Failed to complete onboarding:', error);
    return res.status(500).json({ error: 'Failed to complete visitor onboarding.' });
  }
});