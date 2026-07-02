const mongoose = require('mongoose');

// Schema for tracking chatbot visitors/users and their context
const VisitorSchema = new mongoose.Schema({

     name: {
    type: String,
    required: true,
    trim: true