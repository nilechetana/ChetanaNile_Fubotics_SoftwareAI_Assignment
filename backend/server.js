// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation"); // 👈 NEW
const Groq = require("groq-sdk");

const app = express();

// ---- Middlewares ----
app.use(express.json());
app.use(
  cors({
    origin: "*", // dev ke liye, baad me frontend URL rakh sakte ho
  })
);

// ---- MongoDB connect ----
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---- Groq client (free AI) ----
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

//
// ──────────────────────────────────────────────────────────────
//   CONVERSATIONS ROUTES  (left-side history)
// ──────────────────────────────────────────────────────────────
//

// GET: saare conversations (latest first)
app.get("/api/conversations", async (req, res) => {
  try {
    const convos = await Conversation.find().sort({ createdAt: -1 });
    return res.json(convos);
  } catch (err) {
    console.error("GET /api/conversations error:", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch conversations" });
  }
});

// POST: naya conversation (New Chat button)
app.post("/api/conversations", async (req, res) => {
  try {
    const { title } = req.body;

    const convo = await Conversation.create({
      title: title || "New chat",
    });

    console.log("🆕 Created conversation:", convo._id);
    return res.json(convo);
  } catch (err) {
    console.error("POST /api/conversations error:", err);
    return res
      .status(500)
      .json({ error: "Failed to create conversation" });
  }
});

//
// ──────────────────────────────────────────────────────────────
//   MESSAGES ROUTES  (per conversation)
// ──────────────────────────────────────────────────────────────
//

// GET: ek conversation ka saara chat history
//  /api/messages?conversationId=xxxx
app.get("/api/messages", async (req, res) => {
  try {
    const { conversationId } = req.query;
    console.log("📥 GET /api/messages conversationId =", conversationId);

    if (!conversationId) {
      return res
        .status(400)
        .json({ error: "conversationId is required" });
    }

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    return res.json(messages);
  } catch (err) {
    console.error("GET /api/messages error:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST: user message + AI reply (Groq) ek specific conversation ke liye
app.post("/api/messages", async (req, res) => {
  try {
    const { content, conversationId } = req.body;
    console.log(
      "📥 POST /api/messages. conversationId =",
      conversationId,
      "content =",
      content
    );

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ error: "Message content is required" });
    }
    if (!conversationId) {
      return res
        .status(400)
        .json({ error: "conversationId is required" });
    }

    // 1) Purana history (sirf isi conversation ka)
    const previousMessages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    // 2) Groq ke liye messages format karo
    const chatMessages = [
      {
        role: "system",
        content:
          "You are a helpful AI assistant for a web chat application. " +
          "Answer in very simple English, maximum 120 words. " +
          "When explaining, use short numbered points like '1. ... 2. ...'. " +
          "Do not use markdown formatting like **bold** or ```code```.",
      },
      ...previousMessages.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content },
    ];

    // 3) Pehle user message DB me save karo
    const userMessage = await Message.create({
      conversationId,
      role: "user",
      content,
    });
    console.log("✅ Saved user message:", userMessage._id);

    // 4) Groq se smart AI reply lo
    let aiReplyText = "";

    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", // ✅ new supported model
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 300,
      });

      aiReplyText = completion.choices[0]?.message?.content || "";
      console.log("✅ Got AI reply from Groq");
    } catch (groqError) {
      console.error("Groq AI error:", groqError?.message || groqError);

      // Fallback: agar Groq fail ho jaye
      aiReplyText =
        `I received your message: "${content}". ` +
        "Right now the external AI provider is not responding, " +
        "so this is a fallback response generated by my backend.";
    }

    // 5) AI reply DB me save karo
    const aiMessage = await Message.create({
      conversationId,
      role: "assistant",
      content: aiReplyText,
    });
    console.log("✅ Saved AI message:", aiMessage._id);

    // 6) Updated conversation ka saara chat bhejo
    const updatedMessages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });
    console.log(
      "✅ Sending back",
      updatedMessages.length,
      "messages for",
      conversationId
    );
    return res.json(updatedMessages);
  } catch (err) {
    console.error("❌ Error in POST /api/messages:", err);
    return res.status(500).json({ error: "Failed to process message" });
  }
});
// PATCH: rename conversation
app.patch("/api/conversations/:id", async (req, res) => {
  try {
    const { title } = req.body;
    const { id } = req.params;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const convo = await Conversation.findByIdAndUpdate(
      id,
      { title: title.trim() },
      { new: true }
    );

    return res.json(convo);
  } catch (err) {
    console.error("PATCH /api/conversations error:", err);
    return res.status(500).json({ error: "Failed to rename conversation" });
  }
});

// DELETE: delete conversation + uski saari messages
app.delete("/api/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await Message.deleteMany({ conversationId: id });
    await Conversation.findByIdAndDelete(id);

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/conversations error:", err);
    return res.status(500).json({ error: "Failed to delete conversation" });
  }
});


// ---- Start server ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
