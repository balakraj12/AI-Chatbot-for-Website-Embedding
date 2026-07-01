const mongoose = require('mongoose');


// Schema for individual chat messages in a conversation
const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },