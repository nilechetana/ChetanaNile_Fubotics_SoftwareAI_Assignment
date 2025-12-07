const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } // createdAt, updatedAt mil jayega
);

module.exports = mongoose.model("Conversation", conversationSchema);
