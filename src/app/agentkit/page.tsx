"use client";

import { useState, useEffect, useRef, JSX } from "react";
import { usePrivy } from "@privy-io/react-auth";
import ReactMarkdown from "react-markdown";
import { useName, Name } from "@coinbase/onchainkit/identity";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http, formatEther } from "viem";
import { Gift, ChevronRight, Shield, CheckCircle, Send } from "lucide-react";

export default function OnboardingChatPage() {
  const [userMessage, setUserMessage] = useState("");
  const [chatLog, setChatLog] = useState<
    { sender: "User" | "Agent"; message: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"welcome" | "info" | "complete">(
    "welcome"
  );
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { ready, authenticated, login, logout, user } = usePrivy();
  const disableLogin = !ready || (ready && authenticated);
  const disableLogout = !ready || (ready && !authenticated);
  const USER_WALLET_ADDRESS = user?.customMetadata?.walletAddress;
  const { data: name, isLoading: nameIsLoading } = useName({
    address: USER_WALLET_ADDRESS as `0x${string}`,
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
      setStage("info");
    }
  }, [authenticated, stage]);

  // useEffect(() => {
  //   if (USER_WALLET_ADDRESS && chatLog.length === 0 && !nameIsLoading) {
  //     fetchWelcomeMessage();
  //   }
  // }, [user, nameIsLoading]);
  console.log(name);
  useEffect(() => {
    if (USER_WALLET_ADDRESS) {
      const client = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });
      client
        .getBalance({ address: USER_WALLET_ADDRESS as `0x${string}` })
        .then((balance) => {
          const rawBalance = formatEther(balance);
          const formattedBalance = parseFloat(rawBalance).toFixed(8);
          setEthBalance(formattedBalance);
        })
        .catch((error) => {
          console.error("Error fetching balance:", error);
        });
    }
  }, [USER_WALLET_ADDRESS]);

  const fetchWelcomeMessage = async () => {
    try {
      const res = await fetch("/api/agentkit/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: "",
          userWallet: USER_WALLET_ADDRESS,
          baseName: name || null,
          stage: "welcomemessage",
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
          userWallet: USER_WALLET_ADDRESS,
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const stages: {
    [key in "welcome" | "info" | "complete"]: { component: JSX.Element };
  } = {
    welcome: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-yellow-100 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="w-6 h-6 text-yellow-500" />
              <h3 className="text-lg font-semibold">You&apos;ve Got Crypto!</h3>
            </div>
            <p className="text-gray-700">
              Someone sent you crypto! Let&apos;s help you claim it.
            </p>
          </div>
          {!authenticated && (
            <button
              onClick={login}
              disabled={disableLogin}
              className="w-full py-3 bg-black text-white rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition"
            >
              Claim Your Crypto <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
    info: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-purple-100 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-500" />
              <h3 className="text-lg font-semibold">Getting Started</h3>
            </div>
            <p className="text-gray-700">
              Your wallet is ready. Our AI assistant will guide you through
              crypto basics, trading, and more!
            </p>
          </div>
          <button
            onClick={async () => {
              await fetchWelcomeMessage();
              // Optionally, if fetchWelcomeMessage no longer calls setStage,
              // you can change the stage here after the API call.
              setStage("complete");
            }}
            className="w-full py-3 bg-black text-white rounded-xl hover:opacity-90 transition"
          >
            Start Exploring
          </button>
        </div>
      ),
    },
    complete: {
      component: (
        <div className="space-y-6 mb-6">
          <div className="bg-green-100 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold">You&apos;re All Set!</h3>
            </div>
            <p className="text-gray-700">
              Chat with aether and dive into the crypto world!
            </p>
            <div className="mt-4">
              <h4 className="text-md font-semibold">Your Wallet Info:</h4>
              <p className="text-gray-700">Name: {name || "N/A"}</p>
              <p className="text-gray-700">
                Balance: {ethBalance ? `${ethBalance} ETH` : "Loading..."}
              </p>
              <p className="text-gray-700">
                Address:{" "}
                {typeof USER_WALLET_ADDRESS === "string"
                  ? `${USER_WALLET_ADDRESS.slice(
                      0,
                      6
                    )}...${USER_WALLET_ADDRESS.slice(-4)}`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans">
      <header className="flex justify-between items-center px-8 py-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Aether</h1>
        {user && (
          <button
            disabled={disableLogout}
            onClick={logout}
            className="px-5 py-2 border-2 border-black rounded-full hover:bg-black hover:text-white transition"
          >
            Log Out
          </button>
        )}
      </header>

      <main className="container mx-auto px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-5xl font-extrabold leading-tight mb-4">
            Your Crypto Journey Starts Here
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-lg">
            Claim your basename, explore onchain opportunities, and learn the
            basics of crypto.
          </p>
          {stages[stage].component}
        </div>

        {user && stage === "complete" && (
          <div className="bg-white p-8 rounded-xl shadow-md border-2 border-black">
            <h3 className="text-2xl font-bold mb-4">Chat with Aether</h3>
            <div className="h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-xl border border-black">
              <div className="space-y-4">
                {chatLog.map((entry, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      entry.sender === "User" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl shadow-md ${
                        entry.sender === "Agent"
                          ? "bg-gray-100 text-black"
                          : "bg-black text-white"
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
            <div className="mt-4 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about crypto..."
                className="flex-1 p-4 bg-gray-50 border border-black rounded-xl focus:ring-2 focus:ring-black"
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !userMessage.trim()}
                className="px-4 py-3 bg-black text-white rounded-xl hover:opacity-90 transition"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
