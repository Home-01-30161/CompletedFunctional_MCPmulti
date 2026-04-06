import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, X, Settings2, User, Bot, Loader2, MessageSquare } from 'lucide-react';

// Original dashboard token (has operator.admin scope on the gateway)
const GATEWAY_RAW_TOKEN = "75258da5c6b4767fdd9455a1539ff3bcc793a4197c0f8cdc";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Connection Settings
  const [endpoint, setEndpoint] = useState("ws://127.0.0.1:18789/");
  const [apiKey, setApiKey] = useState(GATEWAY_RAW_TOKEN);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);



  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const currentInput = input.trim();

    const userMessage = { role: "user", content: currentInput };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Format endpoint dynamically
      let wsUrl = endpoint.trim();
      if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
      else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
      else if (!wsUrl.startsWith('ws')) wsUrl = 'ws://' + wsUrl;

      const ws = new WebSocket(wsUrl);

      // Initialize empty assistant message placeholder to stream into
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      let currentAssistantMessage = "";
      let isAuthenticated = false;


      // Helper: send chat.send after authentication
      const sendChat = () => {
        const chatPayload = {
          type: "req",
          id: "msg-" + Date.now(),
          method: "chat.send",
          params: {
            sessionKey: "agent:main:main",
            message: currentInput,   // plain string as required by gateway schema
            idempotencyKey: "idem-" + Date.now() + "-" + Math.random().toString(36).slice(2)
          }
        };
        console.log("📤 Sending chat.send:", chatPayload);
        ws.send(JSON.stringify(chatPayload));
      };

      ws.onopen = () => {
        console.log("WebSocket connected, waiting for connect.challenge...");
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("WebSocket Received:", data);

          // 1. Handle connect.challenge → connect as webchat client
          if (data.type === "event" && data.event === "connect.challenge") {
            const nonce = data.payload?.nonce || data.payload?.ts || "";
            console.log("Challenge received, nonce:", nonce);

            const authPayload = {
              type: "req",
              id: "req-auth-" + Date.now(),
              method: "connect",
              params: {
                minProtocol: 1,
                maxProtocol: 10,
                client: {
                  id: "openclaw-control-ui",
                  version: "1.0.0",
                  mode: "webchat",
                  platform: "web"
                },
                role: "operator",
                scopes: [
                  "operator.read",
                  "operator.write",
                  "operator.admin"
                ],
                auth: {
                  token: apiKey
                }
              }
            };
            console.log("📤 Sending connect:", authPayload);
            ws.send(JSON.stringify(authPayload));
            return;
          }

          // 2. Handle connect.authenticated → send chat.send
          if (data.type === "event" && data.event === "connect.authenticated") {
            if (data.payload?.ok) {
              isAuthenticated = true;
              console.log("✅ Authenticated! Sending chat.send...");
              sendChat();
            } else {
              throw new Error("Authentication rejected by Gateway.");
            }
            return;
          }

          // 3. Handle 'agent' events — streaming delta chunks
          if (data.type === "event" && data.event === "agent" && data.payload) {
            const p = data.payload;
            // content is an array: [{type:"text", text:"..."}]
            const contentArr = p.message?.content ?? [];
            const text = contentArr
              .filter(c => c.type === "text")
              .map(c => c.text)
              .join("");

            if (text) {
              currentAssistantMessage += text;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = currentAssistantMessage;
                return newMsgs;
              });
            }

            if (p.state === "final") {
              console.log("Agent stream final");
              ws.close();
            }
            return;
          }

          // 4. Handle 'chat' events — same payload structure
          if (data.type === "event" && data.event === "chat" && data.payload) {
            const p = data.payload;
            const contentArr = p.message?.content ?? [];
            const text = contentArr
              .filter(c => c.type === "text")
              .map(c => c.text)
              .join("");

            if (text && p.state === "delta") {
              currentAssistantMessage += text;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content = currentAssistantMessage;
                return newMsgs;
              });
            }

            if (p.state === "final") {
              // Set final message and close
              if (text) {
                currentAssistantMessage = text;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content = text;
                  return newMsgs;
                });
              }
              console.log("Chat final, closing.");
              ws.close();
            }
            return;
          }

          // 5. Ignore heartbeat events
          if (data.event === "health" || data.event === "tick") return;

          // 4. Handle res-style responses (fallback)
          if (data.type === "res" && data.ok === true && !isAuthenticated) {
            isAuthenticated = true;
            console.log("Auth OK (res format), sending chat.send...");
            sendChat();
            return;
          }

          // 5. Handle errors
          if ((data.type === "res" && data.ok === false) ||
            (data.type === "event" && data.event === "error")) {
            const errMsg = data.error?.message || data.payload?.message || JSON.stringify(data);
            throw new Error(errMsg);
          }

        } catch (e) {
          console.error("Message Block Error:", e);
          currentAssistantMessage = `❌ Error: ${e.message}`;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].content = currentAssistantMessage;
            newMsgs[newMsgs.length - 1].isError = true;
            return newMsgs;
          });
          ws.close();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setMessages(prev => {
          const newMsgs = [...prev];
          if (currentAssistantMessage === "") {
            newMsgs[newMsgs.length - 1] = {
              role: "assistant",
              content: `❌ WebSocket Connection Error: Could not connect to ${wsUrl}.`,
              isError: true
            };
          } else {
            newMsgs.push({ role: "assistant", content: `❌ Socket Error mid-stream.`, isError: true });
          }
          return newMsgs;
        });
        setIsLoading(false);
      };

      ws.onclose = (event) => {
        console.log("🔴 WebSocket Closed:", event.code, event.reason);
        setIsLoading(false);
      };

    } catch (error) {
      console.error("Setup Error:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `❌ Application Error: ${error.message}`, isError: true }
      ]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className="flex h-screen bg-white text-gray-800 font-sans overflow-hidden">

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Settings */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 bg-gray-50/80 border-r border-gray-200 backdrop-blur-md transform transition-transform duration-300 ease-in-out z-30 flex flex-col ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/90">
          <div className="flex items-center gap-2 font-semibold text-[15px] text-gray-700">
            <Settings2 className="w-4 h-4 text-gray-500" />
            <span>Configuration (WebSocket)</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">Gateway Endpoint</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full text-sm p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm placeholder:text-gray-400"
              placeholder="ws://127.0.0.1:18789/"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-gray-600 uppercase tracking-wider">Gateway Token</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full text-sm p-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm placeholder:text-gray-400"
              placeholder="03e4..."
            />
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full bg-white relative min-w-0">
        {/* Header */}
        <header className="h-[60px] border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-10 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-bold text-lg shadow-sm">
                O
              </div>
              <h1 className="font-semibold text-gray-800 text-lg tracking-tight hidden sm:block">OpenClaw WebUI</h1>
              <h1 className="font-semibold text-gray-800 text-lg tracking-tight sm:hidden">OpenClaw</h1>
            </div>
          </div>
          <div className="text-xs text-gray-600 font-medium px-3 py-1.5 bg-gray-100/80 rounded-lg border border-gray-200/60 shadow-sm flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            ptm-minimax-2.5
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto w-full scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
              <div className="w-16 h-16 mb-5 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 shadow-sm">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-xl font-semibold text-gray-700 mb-2">How can I help you today?</p>
              <p className="max-w-md text-sm text-gray-500 leading-relaxed">WebSocket System is ready. Type a message to connect and stream responses from the OpenClaw Gateway.</p>
            </div>
          ) : (
            <div className="flex flex-col pb-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-6 md:px-8 group ${msg.role === 'assistant' ? 'bg-gray-50/50 border-b border-gray-100/50' : 'bg-white'}`}
                >
                  <div className="max-w-3xl mx-auto flex gap-4 md:gap-5">
                    <div className="flex-shrink-0 mt-0.5">
                      {msg.role === 'user' ? (
                        <div className="w-7 h-7 rounded-sm bg-gray-100 flex items-center justify-center text-gray-600 shrink-0 border border-gray-200">
                          <User className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-sm bg-black flex items-center justify-center text-white shrink-0 shadow-sm">
                          <Bot className="w-4 h-4 ml-px" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="font-semibold text-gray-800 text-[13px]">
                        {msg.role === 'user' ? 'You' : 'OpenClaw WS'}
                      </div>
                      <div className={`text-[15px] leading-relaxed whitespace-pre-wrap ${msg.isError ? 'text-red-500 bg-red-50/50 p-3 rounded-lg border border-red-100 inline-block' : 'text-gray-700'}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="px-4 py-6 md:px-8 bg-gray-50/50 border-b border-gray-100/50">
                  <div className="max-w-3xl mx-auto flex gap-4 md:gap-5">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-7 h-7 rounded-sm bg-black flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 flex items-center py-1">
                      <div className="flex gap-1.5 items-center px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-6" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100">
          <div className="max-w-3xl mx-auto relative group flex items-end gap-2 bg-white border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 rounded-2xl shadow-sm transition-all px-3 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message via WebSocket..."
              className="w-full bg-transparent resize-none focus:outline-none text-[15px] leading-relaxed max-h-48 overflow-y-auto scrollbar-thin px-1 py-1"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-2 rounded-xl flex items-center justify-center transition-all flex-shrink-0 self-end ${!input.trim() || isLoading
                ? 'bg-gray-100 text-gray-400'
                : 'bg-black text-white hover:bg-gray-800 shadow-sm'
                }`}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <div className="text-center text-[11px] text-gray-400 mt-2.5 tracking-wide">
            Connected via OpenClaw WebSocket Gateway
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
