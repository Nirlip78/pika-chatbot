import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  FileText, 
  Settings, 
  Cpu, 
  Trash2, 
  Check, 
  Copy, 
  RotateCcw,
  Sparkles,
  Zap
} from 'lucide-react';
import { checkOllamaStatus, callOllamaStream } from './services/api';
import './index.css';

const DEFAULT_SESSIONS = [
  {
    id: 'default',
    title: 'New Conversation',
    history: []
  }
];

const MODELS = [
  { id: 'phi3', name: 'phi3', icon: '🧠', badge: 'fast' },
  { id: 'llama3', name: 'llama3', icon: '🦙' },
  { id: 'mistral', name: 'mistral', icon: '🌀' },
  { id: 'gemma', name: 'gemma', icon: '💎' },
  { id: 'tinyllama', name: 'tinyllama', icon: '⚡', badge: 'lite' }
];

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('pika_sessions');
    return saved ? JSON.parse(saved) : DEFAULT_SESSIONS;
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('pika_active_session');
    return saved || 'default';
  });
  const [selectedModel, setSelectedModel] = useState('phi3');
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [attachedDoc, setAttachedDoc] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    localStorage.setItem('pika_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('pika_active_session', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    const check = async () => {
      const status = await checkOllamaStatus();
      setIsOnline(status);
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession.history, isThinking]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedDoc({
        name: file.name,
        content: event.target.result
      });
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession = {
      id: newId,
      title: 'New Conversation',
      history: []
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newId);
  };

  const handleDeleteSession = (e, id) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      setSessions(DEFAULT_SESSIONS);
      setActiveSessionId('default');
      return;
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !attachedDoc) || isThinking) return;

    let finalContent = inputValue.trim();
    if (attachedDoc) {
      if (finalContent) {
        finalContent = `I have attached a document named "${attachedDoc.name}".\n\nDocument Content:\n---\n${attachedDoc.content}\n---\n\nMy prompt: ${finalContent}`;
      } else {
        finalContent = `I have attached a document named "${attachedDoc.name}".\n\nDocument Content:\n---\n${attachedDoc.content}\n---\n\nPlease analyze this document.`;
      }
    }

    const userMsg = { 
      role: 'user', 
      content: finalContent,
      displayContent: inputValue.trim() || 'Uploaded a document.',
      attachmentName: attachedDoc?.name
    };

    const updatedHistory = [...activeSession.history, userMsg];
    
    // Update title if it's the first message
    let updatedTitle = activeSession.title;
    if (activeSession.history.length === 0) {
      const firstText = inputValue.trim() || attachedDoc?.name || 'New Conversation';
      updatedTitle = firstText.slice(0, 20) + (firstText.length > 20 ? '...' : '');
    }

    setSessions(sessions.map(s => 
      s.id === activeSessionId 
        ? { ...s, title: updatedTitle, history: updatedHistory } 
        : s
    ));
    setInputValue('');
    setAttachedDoc(null);
    setIsThinking(true);

    try {
      let fullBotResponse = '';
      const apiMessages = updatedHistory.map(m => ({ role: m.role, content: m.content }));
      
      await callOllamaStream(selectedModel, apiMessages, (chunk, fullText) => {
        fullBotResponse = fullText;
        // Update history in real-time
        setSessions(prev => prev.map(s => 
          s.id === activeSessionId 
            ? { 
                ...s, 
                history: [...updatedHistory, { role: 'assistant', content: fullText }] 
              } 
            : s
        ));
        setIsThinking(false); // Hide thinking once we get chunks
      });
    } catch (err) {
      console.error('Error in chat:', err);
      setIsThinking(false);
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { 
              ...s, 
              history: [...updatedHistory, { role: 'system', content: '❌ Error: Ollama connection failed. Is it running?' }] 
            } 
          : s
      ));
    }
  };

  return (
    <div className="app-container">
      {/* Animated background blobs */}
      <div className="bg-blobs" aria-hidden="true">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-mascot">
              <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="mascotGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa"/>
                    <stop offset="100%" stopColor="#ec4899"/>
                  </linearGradient>
                </defs>
                <rect x="8" y="10" width="24" height="18" rx="6" fill="url(#mascotGrad)"/>
                <circle cx="15" cy="17" r="3" fill="white"/>
                <circle cx="25" cy="17" r="3" fill="white"/>
                <circle cx="16" cy="17" r="1.5" fill="#1a1a2e"/>
                <circle cx="26" cy="17" r="1.5" fill="#1a1a2e"/>
                <path d="M15 22 Q20 26 25 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <rect x="6" y="8" width="5" height="8" rx="2.5" fill="url(#mascotGrad)"/>
                <rect x="29" y="8" width="5" height="8" rx="2.5" fill="url(#mascotGrad)"/>
                <rect x="13" y="27" width="4" height="7" rx="2" fill="url(#mascotGrad)"/>
                <rect x="23" y="27" width="4" height="7" rx="2" fill="url(#mascotGrad)"/>
              </svg>
            </div>
            <div className="brand-text">
              <div className="brand-name">Pika</div>
              <div className="brand-sub">powered by ollama ✨</div>
            </div>
            <div className={`status-pill ${!isOnline ? 'offline' : ''}`}>
              <div className={`status-dot ${!isOnline ? 'offline' : ''}`}></div>
              <span>{isOnline ? 'online' : 'offline'}</span>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label"><MessageSquare size={14} /> Sessions</div>
            <div className="session-list">
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  className={`session-item ${s.id === activeSessionId ? 'active' : ''}`}
                  onClick={() => setActiveSessionId(s.id)}
                >
                  <div className="session-title">{s.title}</div>
                  <button className="delete-session" onClick={(e) => handleDeleteSession(e, s.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label"><Cpu size={14} /> AI Model</div>
            <div className="model-list">
              {MODELS.map(m => (
                <button 
                  key={m.id}
                  className={`model-chip ${selectedModel === m.id ? 'active' : ''}`}
                  onClick={() => setSelectedModel(m.id)}
                >
                  <span className="model-icon">{m.icon}</span>
                  {m.name}
                  {m.badge && <span className="model-badge">{m.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-footer">
            <button className="new-chat-btn" onClick={handleNewChat}>
              <Plus size={16} /> New Chat
            </button>
          </div>
        </aside>

        {/* CHAT AREA */}
        <main className="chat-area">
          <header className="chat-topbar">
            <div className="chat-topbar-info">
              <div className="chat-topbar-name">{activeSession.title} ✨</div>
              <div className="chat-topbar-sub">Chatting with {selectedModel}</div>
            </div>
          </header>

          <div className="messages">
            {activeSession.history.length === 0 ? (
              <div className="welcome">
                <div className="welcome-mascot">
                   <svg width="80" height="80" viewBox="0 0 40 40" fill="none">
                    <rect x="8" y="10" width="24" height="18" rx="6" fill="url(#mascotGrad)"/>
                    <circle cx="15" cy="17" r="3" fill="white"/>
                    <circle cx="25" cy="17" r="3" fill="white"/>
                    <circle cx="16" cy="17" r="1.5" fill="#1a1a2e"/>
                    <circle cx="26" cy="17" r="1.5" fill="#1a1a2e"/>
                    <path d="M15 22 Q20 26 25 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </svg>
                </div>
                <div className="welcome-title">Hey, I'm Pika! 👋</div>
                <div className="welcome-sub">Ask me anything ⚡ I run fully offline — no internet, no limits, just vibes.</div>
                <div className="welcome-tips">
                  {["What can you help me with?", "Tell me a fun fact!", "Write a poem about AI"].map(tip => (
                    <div key={tip} className="tip-pill" onClick={() => { setInputValue(tip); chatInputRef.current?.focus(); }}>
                      💡 {tip}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              activeSession.history.map((msg, i) => (
                <div key={i} className={`msg ${msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system-msg' : 'bot'}`}>
                  {msg.role !== 'system' && (
                    <div className={`msg-avatar ${msg.role === 'user' ? 'user-avatar' : 'bot-avatar'}`}>
                      {msg.role === 'user' ? 'U' : (
                        <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                          <rect x="8" y="10" width="24" height="18" rx="6" fill="url(#mascotGrad)"/>
                          <circle cx="15" cy="17" r="3" fill="white"/>
                          <circle cx="25" cy="17" r="3" fill="white"/>
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="msg-content">
                    {msg.role !== 'system' && (
                      <div className="msg-meta">
                        {msg.role === 'user' ? 'You' : 'Pika ✨'}
                      </div>
                    )}
                    <div className="msg-bubble">
                      {msg.attachmentName && (
                        <div className="attachment-chip-msg">
                          <FileText size={14} />
                          <span>{msg.attachmentName}</span>
                        </div>
                      )}
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.displayContent !== undefined ? msg.displayContent : msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isThinking && (
              <div className="msg bot thinking-msg">
                <div className="msg-avatar bot-avatar">
                  <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
                    <rect x="8" y="10" width="24" height="18" rx="6" fill="url(#mascotGrad)"/>
                  </svg>
                </div>
                <div className="msg-content">
                  <div className="msg-meta">Pika ✨</div>
                  <div className="msg-bubble">
                    <div className="thinking-dots">
                      <span></span><span></span><span></span>
                    </div>
                    <span className="thinking-label">Pika is cooking... ⚡</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-bar-container">
            {attachedDoc && (
              <div className="attachment-preview">
                <div className="attachment-name">
                  <FileText size={14} />
                  {attachedDoc.name}
                  <button className="remove-attachment" onClick={() => setAttachedDoc(null)}><Trash2 size={14}/></button>
                </div>
              </div>
            )}
            <div className="input-bar">
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
                accept=".txt,.md,.csv,.json,.js,.py,.html,.css"
              />
              <button className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={isThinking} title="Attach Document">
                <FileText size={20} />
              </button>
              <div className="input-wrap">
                <textarea 
                ref={chatInputRef}
                className="chat-input" 
                rows="1"
                placeholder="Ask me anything… ✨"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              ></textarea>
            </div>
            <button className="send-btn" onClick={handleSendMessage} disabled={isThinking || (!inputValue.trim() && !attachedDoc)}>
              <Send size={20} />
            </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
