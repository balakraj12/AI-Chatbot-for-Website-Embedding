const mongoose = require('mongoose');


// Schema for individual chat messages in a conversation


  sender: {
    type: String,
    enum: ['visitor', 'ai'],
    required: true
  },
   text: {
    type: String,
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Message', MessageSchema);