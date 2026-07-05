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


/**
 * @route   GET /api/widget/history/:visitorId
 * @desc    Fetch previous message history and active conversation details for a returning visitor.
 */
app.get('/api/widget/history/:visitorId', async (req, res) => {
  const { visitorId } = req.params;
  console.log(`[WIDGET] [HISTORY] Fetching history logs for visitor ID: ${visitorId}`);
    try {
    if (!mongoose.Types.ObjectId.isValid(visitorId)) {
      console.warn(`[WIDGET] [HISTORY] [BAD REQUEST] Invalid visitor ID: ${visitorId}`);
      return res.status(400).json({ error: 'Invalid visitor ID.' });
    }
// Check if the visitor profile exists
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      console.warn(`[WIDGET] [HISTORY] [NOT FOUND] Visitor not found: ${visitorId}`);
      return res.status(404).json({ error: 'Visitor not found.' });
    }

     // Find the latest conversation for this visitor
    const conversation = await Conversation.findOne({ visitorId }).sort({ createdAt: -1 });
    if (!conversation) {
      console.log(`[WIDGET] [HISTORY] No active conversation session found for visitor "${visitor.name}".`);
      return res.status(200).json({ visitorName: visitor.name, conversationId: null, messages: [] });
    }

     // Retrieve all message history for this conversation
    const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    console.log(`[WIDGET] [HISTORY] [SUCCESS] Retrieved ${messages.length} messages for visitor "${visitor.name}".`);

     return res.status(200).json({
      visitorName: visitor.name,
      conversationId: conversation._id,
      messages: messages.map(msg => ({
        sender: msg.sender,
        text: msg.text,
        createdAt: msg.createdAt
      }))
    });

     } catch (error) {
    console.error('[WIDGET] [HISTORY] [ERROR] Failed to fetch chat history:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversation history.' });
  }
});

/**
 * @route   POST /api/widget/chat
 * @desc    Handle chat messages. Merges visitor context and system specs,
 *          saves conversation history, and returns the response from the Groq model.
 */
app.post('/api/widget/chat', async (req, res) => {
  const { visitorId, conversationId, text } = req.body;
  
  console.log(`\n================== [CHAT PIPELINE START] ==================`);
  console.log(`[WIDGET] [CHAT] New message received from visitor ID: ${visitorId}`);
  console.log(`[WIDGET] [CHAT] Message Text: "${text}"`);

   try {
    if (!visitorId || !conversationId || !text) {
      console.warn(`[WIDGET] [CHAT] [BAD REQUEST] Missing required body fields.`);
      console.log(`================== [CHAT PIPELINE END] ==================\n`);
      return res.status(400).json({ error: 'visitorId, conversationId, and text are required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(visitorId) || !mongoose.Types.ObjectId.isValid(conversationId)) {
      console.warn(`[WIDGET] [CHAT] [BAD REQUEST] Invalid ID formats.`);
      console.log(`================== [CHAT PIPELINE END] ==================\n`);
      return res.status(400).json({ error: 'Invalid visitor or conversation ID.' });
    }

    // 1. Fetch visitor details to compile smart personalized context
    const visitor = await Visitor.findById(visitorId);
    if (!visitor) {
      console.warn(`[WIDGET] [CHAT] [NOT FOUND] Visitor profile not found for ID: ${visitorId}`);
      console.log(`================== [CHAT PIPELINE END] ==================\n`);
      return res.status(404).json({ error: 'Visitor profile not found.' });
    }

    console.log(`[WIDGET] [CHAT] Loaded Context -> Name: "${visitor.name}" | Profession: "${visitor.profession}" | Goal: "${visitor.goal}"`);

      // 2. Save the incoming visitor message in the DB
    const visitorMessage = new Message({
      conversationId,
      sender: 'visitor',
      text
    });
    await visitorMessage.save();
    console.log(`[WIDGET] [CHAT] User message saved to database.`);

    // 3. Fetch past messages in the conversation (limit to last 20 for prompt token safety)
    const pastMessages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(20);

    // Format past messages for the Groq API completion structure
    const formattedChatHistory = pastMessages.map(msg => ({
      role: msg.sender === 'visitor' ? 'user' : 'assistant',
      content: msg.text
    }));

     // 4. Inject system instructions combined with visitor context (Name, Profession, Goal)
    const visitorContext = `
[VISITOR PROFILE FOR PERSONALIZATION]:
- Visitor Name: ${visitor.name}
- Profession: ${visitor.profession}
- Primary Goal: ${visitor.goal}

Please customize all your responses to fit this profile context. Direct your advice, examples, and greetings appropriately based on these values. Do not break character.
`;

 const fullSystemInstructions = `${config.SYSTEM_PROMPT}\n${visitorContext}`;
    console.log(`[WIDGET] [CHAT] Compiled system instruction instructions for AI.`);

    // Construct final prompt payloads
    const promptMessages = [
      { role: 'system', content: fullSystemInstructions },
      ...formattedChatHistory
    ];
   
