"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { usePrivy, useConnectWallet } from "@privy-io/react-auth";
import { parseUnits } from "viem";
import { ArrowRight, Wallet, Mail, Coins } from "lucide-react";

const Home: NextPage = () => {
  const [senderWallet, setSenderWallet] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const { getAccessToken } = usePrivy();
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      setSenderWallet(wallet.address);
    },
    onError: (error) => {
      console.error("Wallet connection error:", error);
    },
  });

  // Helper functions remain the same
  const sendFunds = async (recipientAddress: string, amountEth: string) => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No wallet provider found");
    }
    try {
      const valueHex = "0x" + parseUnits(amountEth, 18).toString(16);
      const txHash = await (window as any).ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: senderWallet,
            to: recipientAddress,
            value: valueHex,
          },
        ],
      });
      return txHash;
    } catch (error) {
      console.error("Transaction error:", error);
      throw error;
    }
  };

  const handleOnboard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      const onboardRes = await fetch("/api/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email, senderWallet }),
      });
      const onboardData = await onboardRes.json();
      if (!onboardRes.ok) {
        setMessage(`Onboarding error: ${onboardData.error}`);
        setLoading(false);
        return;
      }

      const newUserWallet = onboardData.user?.wallet?.address;
      if (!newUserWallet) {
        setMessage("Onboarding error: No wallet address returned");
        setLoading(false);
        return;
      }

      const txHash = await sendFunds(newUserWallet, amount);
      setMessage(
        `Success! Transaction hash: ${txHash.slice(0, 10)}...${txHash.slice(
          -8
        )}`
      );
    } catch (error: any) {
      console.error("Onboarding error:", error);
      setMessage("Failed to onboard user or send funds");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-black text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-6 pt-16 pb-8">
        <h1 className="text-5xl font-bold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          CryptoLaunch
        </h1>
        <p className="text-xl text-center text-gray-300 mb-12">
          Your gateway to the world of cryptocurrency - Simple, secure, and
          instant
        </p>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 flex flex-col items-center">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <Wallet className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Secure Wallets</h3>
            <p className="text-gray-300">
              Instantly create and manage digital wallets with bank-grade
              security
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <Coins className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Easy Transfers</h3>
            <p className="text-gray-300">
              Send crypto to anyone, anywhere - all they need is an email
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <Mail className="w-8 h-8 text-pink-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Email Access</h3>
            <p className="text-gray-300">
              No complex keys or passwords - just use your email to get started
            </p>
          </div>
        </div>

        {/* Onboarding Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mb-12">
          {!senderWallet ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-6">Get Started</h2>
              <button
                onClick={connectWallet}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-center">
                Send Crypto
              </h2>
              <p className="text-sm text-gray-300 mb-6 break-all">
                Connected: {senderWallet.slice(0, 6)}...{senderWallet.slice(-4)}
              </p>
              <form onSubmit={handleOnboard} className="space-y-6">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-gray-300 mb-2 text-sm"
                  >
                    Recipient Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="amount"
                    className="block text-gray-300 mb-2 text-sm"
                  >
                    Amount (ETH)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.001"
                    className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition text-white placeholder-gray-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    "Processing..."
                  ) : (
                    <>
                      Send Funds
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {message && (
            <div
              className={`mt-6 p-4 rounded-xl ${
                message.includes("Success")
                  ? "bg-green-500/20 text-green-300"
                  : "bg-red-500/20 text-red-300"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
