"use client";

import { useState, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ReactMarkdown from "react-markdown";
import { IdentityCard, useName, Name } from "@coinbase/onchainkit/identity";
import { baseSepolia } from "viem/chains";
import { Gift, ChevronRight, Shield, CheckCircle } from "lucide-react";

export default function OnboardingChatPage() {
  const [userMessage, setUserMessage] = useState("");
  const [chatLog, setChatLog] = useState<
    { sender: "User" | "Agent"; message: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("welcome"); // "welcome", "info", "complete"
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef(null);

  const { ready, authenticated, login, logout, user } = usePrivy();
  const disableLogin = !ready || (ready && authenticated);
  const disableLogout = !ready || (ready && !authenticated);

  const { data: name, isLoading: nameIsLoading } = useName({
    address: user?.customMetadata?.walletAddress as `0x${string}`,
    chain: baseSepolia,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);

  useEffect(() => {
    if (authenticated && stage === "welcome") {
      setStage("complete");
    }
  }, [authenticated, stage]);

  useEffect(() => {
    if (user?.wallet?.address && chatLog.length === 0 && !nameIsLoading) {
      fetchWelcomeMessage();
    }
  }, [user, nameIsLoading]);

  const fetchWelcomeMessage = async () => {
    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "",
          userWallet: user?.wallet?.address,
          baseName: name || null,
          stage: "welcomemessage", // for the initial welcome message
          metadata: user?.customMetadata,
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

        setStage("complete");
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
          metadata: user?.customMetadata,
          stage: "complete",
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
        if (data.nextStage) {
          setStage(data.nextStage);
        }
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

  // Define stage components.
  const stages = {
    welcome: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6 text-blue-400" />
              <h3 className="text-lg font-semibold">You've Received Crypto!</h3>
            </div>
            <p className="text-gray-600">
              Someone has sent you crypto! Let's help you claim it.
            </p>
          </div>
          {!authenticated && (
            <button
              onClick={login}
              disabled={disableLogin}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center gap-2 text-white hover:from-blue-600 hover:to-purple-600 transition-all"
            >
              Get Started with Email <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
    info: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-white/10 p-6 rounded-xl shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold">
                Getting Started in Crypto
              </h3>
            </div>
            <p className="text-gray-600">
              Your wallet is ready to use. Our AI assistant is here to guide you
              through the exciting world of crypto—from trading and yield
              opportunities to NFTs and more.
            </p>
            <p className="text-gray-600">
              When you're ready to dive in, click "Next" to begin chatting with
              our assistant.
            </p>
          </div>
          <button
            onClick={() => setStage("complete")}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center gap-2 text-white hover:from-blue-600 hover:to-purple-600 transition-all"
          >
            Next
          </button>
        </div>
      ),
    },
    complete: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-green-500/20 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold">All Set!</h3>
            </div>
            <p className="text-gray-600">
              You're all set to explore the world of crypto with our AI
              assistant.
            </p>
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Welcome to CryptoLaunch
          </h1>
          {user && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <div>
                <div>
                  Signed in as:{" "}
                  <span className="font-semibold">{user.email?.address}</span>
                </div>
                <div className="text-xs text-gray-500">
                  <Name
                    key={name}
                    address={
                      user?.customMetadata?.walletAddress as `0x${string}`
                    }
                    chain={baseSepolia}
                    //className="h-24"
                    // style={{ height: "96px" }}
                  />
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
          )}
        </div>

        {/* Stage Component */}
        <div className="p-6 bg-gray-50">{stages[stage].component}</div>

        {/* Only show chat if the stage is "complete" */}
        {user && stage === "complete" && (
          <>
            <div className="h-[400px] overflow-y-auto p-6 bg-gray-50">
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
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Chat with your AI assistant..."
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
          </>
        )}

        {/* Progress Indicator - only show if not complete */}
        {stage !== "complete" && (
          <div className="px-6 py-4 bg-white border-t border-gray-100">
            <div className="flex justify-between">
              {Object.keys(stages).map((key, index) => (
                <div
                  key={key}
                  className={`flex items-center ${
                    index !== Object.keys(stages).length - 1 ? "flex-1" : ""
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${
                      Object.keys(stages).indexOf(stage) >= index
                        ? "bg-blue-500"
                        : "bg-gray-200"
                    }`}
                  >
                    {Object.keys(stages).indexOf(stage) > index && (
                      <CheckCircle className="w-4 h-4 text-white" />
                    )}
                  </div>
                  {index !== Object.keys(stages).length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        Object.keys(stages).indexOf(stage) > index
                          ? "bg-blue-500"
                          : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
