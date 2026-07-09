const mongoose = require('mongoose');

    ref: 'Visitor',
    required: true
  },

   createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Conversation', ConversationSchema);