"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ReactMarkdown from "react-markdown";
import { IdentityCard, useName } from "@coinbase/onchainkit/identity";
import { baseSepolia } from "viem/chains";

export default function AgentChatPage() {
  const [userMessage, setUserMessage] = useState("");
  const [chatLog, setChatLog] = useState<
    { sender: "User" | "Agent"; message: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(null);

  const { ready, authenticated, login, logout, user } = usePrivy();
  const disableLogin = !ready || (ready && authenticated);
  const disableLogout = !ready || (ready && !authenticated);

  const { data: name, isLoading: nameIsLoading } = useName({
    address: "0x5df0379b9c74d600c943e1f05150703c734263e4",
    chain: baseSepolia,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);

  useEffect(() => {
    if (user?.wallet?.address && chatLog.length === 0) {
      fetchWelcomeMessage();
    }
  }, [user, chatLog.length]);

  const fetchWelcomeMessage = async () => {
    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "",
          userWallet: user?.wallet?.address,
          baseName: name || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setChatLog((prev) => [
          ...prev,
          { sender: "Agent", message: `Error: ${data.error}` },
        ]);
      } else {
        setChatLog((prev) => [
          ...prev,
          { sender: "Agent", message: data.response || "No response" },
        ]);
      }
    } catch (error) {
      console.error("Error fetching welcome message:", error);
      setChatLog((prev) => [
        ...prev,
        { sender: "Agent", message: "Error fetching welcome message." },
      ]);
    }
  };

  const handleSendMessage = async () => {
    if (userMessage.trim().length === 0) return;

    setChatLog((prev) => [...prev, { sender: "User", message: userMessage }]);
    const currentMessage = userMessage;
    setUserMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: currentMessage,
          userWallet: user?.wallet?.address,
          baseName: name || null,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setChatLog((prev) => [
          ...prev,
          { sender: "Agent", message: `Error: ${data.error}` },
        ]);
      } else {
        setChatLog((prev) => [
          ...prev,
          { sender: "Agent", message: data.response || "No response" },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setChatLog((prev) => [
        ...prev,
        { sender: "Agent", message: "Error processing message." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (nameIsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-600">Loading identity...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            AgentKit Chat
          </h1>
          <IdentityCard
            address="0x5df0379b9c74D600C943e1F05150703C734263e4"
            chain={baseSepolia}
          />

          {/* Auth Section */}
          {user ? (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div>
                <div>
                  Signed in as:{" "}
                  <span className="font-semibold">{user.email?.address}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {user.wallet?.address}
                </div>
              </div>
              <button
                disabled={disableLogout}
                onClick={logout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              disabled={disableLogin}
              onClick={login}
              className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              Sign In with Email
            </button>
          )}
        </div>

        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto p-6 bg-gray-50">
          <div className="space-y-4">
            {chatLog.map((entry, idx) => (
              <div
                key={idx}
                className={`flex ${
                  entry.sender === "User" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                    entry.sender === "Agent"
                      ? "bg-white text-gray-800"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  <ReactMarkdown className="prose prose-sm max-w-none">
                    {entry.message}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 p-4 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !userMessage.trim()}
              className="px-6 py-4 bg-blue-600 text-white rounded-xl transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
