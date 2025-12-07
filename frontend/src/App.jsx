import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:5000";

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState("dark"); // 🌙 / ☀️

  // ---- helper: messages load ----
  const fetchMessages = async (conversationId) => {
    if (!conversationId) return;
    const res = await axios.get(`${API_BASE}/api/messages`, {
      params: { conversationId },
    });
    setMessages(res.data);
  };

  // ---- load conversations on mount ----
  useEffect(() => {
    const load = async () => {
      const res = await axios.get(`${API_BASE}/api/conversations`);

      if (res.data.length === 0) {
        const createRes = await axios.post(`${API_BASE}/api/conversations`, {
          title: "New chat",
        });
        const convo = createRes.data;
        setConversations([convo]);
        setActiveId(convo._id);
        setMessages([]);
      } else {
        setConversations(res.data);
        const first = res.data[0];
        setActiveId(first._id);
        fetchMessages(first._id);
      }
    };

    load();
  }, []);

  // ---- New Chat ----
  const startNewChat = async () => {
    const res = await axios.post(`${API_BASE}/api/conversations`, {
      title: `New chat`,
    });
    const convo = res.data;
    setConversations([convo, ...conversations]);
    setActiveId(convo._id);
    setMessages([]);
  };

  // ---- Rename Chat ----
  const renameChat = async (e, convo) => {
    e.stopPropagation();
    const newTitle = window.prompt("Enter new name for this chat:", convo.title);
    if (!newTitle || !newTitle.trim()) return;

    const res = await axios.patch(
      `${API_BASE}/api/conversations/${convo._id}`,
      { title: newTitle }
    );

    const updated = conversations.map((c) =>
      c._id === convo._id ? res.data : c
    );
    setConversations(updated);
  };

  // ---- Delete Chat ----
  const deleteChat = async (e, convo) => {
    e.stopPropagation();
    const ok = window.confirm(
      `Delete chat "${convo.title}"? This cannot be undone.`
    );
    if (!ok) return;

    await axios.delete(`${API_BASE}/api/conversations/${convo._id}`);

    const remaining = conversations.filter((c) => c._id !== convo._id);
    setConversations(remaining);

    if (activeId === convo._id) {
      if (remaining.length > 0) {
        setActiveId(remaining[0]._id);
        fetchMessages(remaining[0]._id);
      } else {
        const res = await axios.post(`${API_BASE}/api/conversations`, {
          title: "New chat",
        });
        const newConvo = res.data;
        setConversations([newConvo]);
        setActiveId(newConvo._id);
        setMessages([]);
      }
    }
  };

  // ---- send message ----
  const sendMessage = async () => {
    if (!input.trim() || !activeId) return;

    const res = await axios.post(`${API_BASE}/api/messages`, {
      content: input,
      conversationId: activeId,
    });

    setMessages(res.data);
    setInput("");
  };

  // ---- UI ----
  return (
    <div className={`app-layout ${theme}`}>
      {/* LEFT SIDEBAR (history) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            + New Chat
          </button>
        </div>

        <div className="sidebar-list">
          {conversations.map((c) => (
            <div
              key={c._id}
              className={
                "sidebar-item " + (c._id === activeId ? "active" : "")
              }
              onClick={() => {
                setActiveId(c._id);
                fetchMessages(c._id);
              }}
            >
              <div className="sidebar-item-main">
                <span className="sidebar-title">
                  {c.title || "Untitled chat"}
                </span>
                <div className="sidebar-actions">
                  <button
                    className="sidebar-icon-btn"
                    title="Rename"
                    onClick={(e) => renameChat(e, c)}
                  >
                    ✏
                  </button>
                  <button
                    className="sidebar-icon-btn"
                    title="Delete"
                    onClick={(e) => deleteChat(e, c)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="sidebar-empty">No chats yet</div>
          )}
        </div>
      </aside>

      {/* RIGHT MAIN AREA (ChatGPT-style column) */}
      <div className="main-area">
        <main className="chat-container">
          <div className="header-row">
            <div>
              <div className="chat-header">Fubotics AI Chat</div>
              <div className="chat-subtitle">
                Software & AI Internship Assignment — Chetana Nile
              </div>
            </div>

            <div className="header-right">
              <span className="online-badge">🟢 Online</span>
              <button
                className="theme-toggle"
                onClick={() =>
                  setTheme((prev) => (prev === "dark" ? "light" : "dark"))
                }
              >
                {theme === "dark" ? "☀ Light" : "🌙 Dark"}
              </button>
            </div>
          </div>

          <div className="messages-box">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`message-row ${
                  msg.role === "user" ? "user" : "ai"
                }`}
              >
                <div className="bubble">{msg.content}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: "#9ca3af", marginTop: 16 }}>
                No messages yet. Type something to start this chat.
              </div>
            )}
          </div>

          <div className="input-area">
            <input
              type="text"
              placeholder="Type your message and hit Enter..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
