"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ReactMarkdown from "react-markdown";

export default function AgentChatPage() {
  const [userMessage, setUserMessage] = useState("");
  const [chatLog, setChatLog] = useState<
    { sender: "User" | "Agent"; message: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const { ready, authenticated, login, logout, user } = usePrivy();

  const disableLogin = !ready || (ready && authenticated);
  const disableLogout = !ready || (ready && !authenticated);
  console.log("Current user:", user);

  // Clear Privy session on page load (adjust as needed)
  useEffect(() => {
    localStorage.removeItem("privy:session");
    localStorage.removeItem("privy:connectedWallet");
  }, []);

  // Function to fetch the welcome message from the agent.
  // src/app/agentkit/page.tsx (excerpt)
  const fetchWelcomeMessage = async () => {
    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send an empty message plus extra info so that the backend can decide what to say.
        body: JSON.stringify({
          userMessage: "",
          userWallet: user?.wallet?.address,
          //baseName: user?.profile?.baseName || null, // extra field for personalization
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

  // Automatically fetch the welcome message when the user and wallet are available.
  useEffect(() => {
    if (chatLog.length === 0 && user?.wallet?.address) {
      fetchWelcomeMessage();
    }
  }, [user]);

  const handleSendMessage = async () => {
    // Do nothing if there is no user message.
    if (userMessage.trim().length === 0) return;

    // Log the user's message.
    setChatLog((prev) => [...prev, { sender: "User", message: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: userMessage,
          userWallet: user?.wallet?.address,
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
      setUserMessage("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <div className="w-full max-w-xl bg-white shadow-md rounded-lg p-6">
        <h1 className="text-3xl font-bold mb-4 text-center text-gray-800">
          AgentKit Chat
        </h1>

        {/* User Info */}
        {user ? (
          <div className="mb-4 text-center text-sm text-gray-600">
            Signed in as: <strong>{user.email?.address}</strong>
            <br />
            Wallet: {user.wallet?.address}
            <div className="mt-2">
              <button
                disabled={disableLogout}
                onClick={logout}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex justify-center">
            <button
              disabled={disableLogin}
              onClick={login}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Sign In with Email
            </button>
          </div>
        )}

        <div className="h-80 overflow-y-auto border rounded-lg p-4 bg-gray-100 space-y-4">
          {chatLog.map((entry, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg shadow ${
                entry.sender === "Agent"
                  ? "bg-blue-100 text-blue-800 self-start"
                  : "bg-green-100 text-green-800 self-end"
              }`}
            >
              <strong>{entry.sender}:</strong>
              <ReactMarkdown className="prose prose-sm">
                {entry.message}
              </ReactMarkdown>
            </div>
          ))}
        </div>

        <div className="flex mt-4">
          <input
            type="text"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            placeholder="Enter your message..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 mr-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSendMessage}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
