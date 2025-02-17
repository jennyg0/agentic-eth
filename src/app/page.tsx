"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { usePrivy, useConnectWallet } from "@privy-io/react-auth";
import { parseUnits } from "viem";
import { ArrowRight, Wallet, Rocket, Coins } from "lucide-react";

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
        setMessage(`Oops! Something went wrong: ${onboardData.error}`);
        setLoading(false);
        return;
      }

      const newUserWallet = onboardData.user?.customMetadata.walletAddress;

      if (!newUserWallet) {
        setMessage("Couldn't find the wallet address. Try again!");
        setLoading(false);
        return;
      }

      const txHash = await sendFunds(newUserWallet, amount);
      setMessage(`Funds sent! 🎉 Transaction hash: ${txHash}`);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      setMessage("Something went wrong while onboarding. Try again!");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black font-sans">
      {/* Header Section */}
      <header className="flex justify-between items-center px-8 py-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Aether</h1>
        <button
          onClick={connectWallet}
          className="px-5 py-2 border-2 border-black rounded-full hover:bg-black hover:text-white transition"
        >
          {senderWallet ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </header>

      {/* Hero Section with Form */}
      <section className="flex flex-col md:flex-row p-12">
        <div className="md:w-2/3 pl-4">
          <h2 className="text-6xl font-extrabold leading-tight mb-4 pt-10">
            Bring your Friends Onchain
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-lg">
            Send crypto to anyone&apos;s email, and let us guide them through
            their first onchain experience.
          </p>
          <button
            onClick={connectWallet}
            className="py-3 px-6 bg-black text-white text-lg font-medium rounded-full hover:opacity-90 transition"
          >
            {senderWallet
              ? "Wallet connected"
              : "Connect your wallet to get started"}
          </button>
        </div>

        {/* Onboarding Form Positioned Beside Hero Text */}
        <div className="bg-white p-8 rounded-xl shadow-md border-2 border-black w-full max-w-md">
          <h3 className="text-2xl font-bold mb-4">Send Crypto Now</h3>
          <form onSubmit={handleOnboard} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-gray-700 mb-1 font-medium"
              >
                Recipient&apos;s Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="friend@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="amount"
                className="block text-gray-700 mb-1 font-medium"
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
                className="w-full px-4 py-3 border border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="0.001"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !senderWallet}
              className="w-full py-3 bg-black text-white font-bold rounded-full hover:opacity-90 transition"
            >
              {loading ? "Sending..." : "Send Now"}
              <ArrowRight className="w-5 h-5 ml-2 inline" />
            </button>
          </form>

          {message && (
            <div
              className={`mt-6 p-4 rounded-lg text-center ${
                message.includes("Success")
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 rounded-xl border-2 border-black">
          <Wallet className="w-10 h-10 mb-4 text-black" />
          <h3 className="text-xl font-semibold mb-2">Effortless Setup</h3>
          <p className="text-gray-600">
            Instantly create wallets without any complicated setup.
          </p>
        </div>
        <div className="p-6 rounded-xl border-2 border-black">
          <Coins className="w-10 h-10 mb-4 text-black" />
          <h3 className="text-xl font-semibold mb-2">Send via Email</h3>
          <p className="text-gray-600">
            Send crypto using just an email address—no wallet needed for the
            recipient.
          </p>
        </div>
        <div className="p-6 rounded-xl border-2 border-black">
          <Rocket className="w-10 h-10 mb-4 text-black" />
          <h3 className="text-xl font-semibold mb-2">
            Explore Onchain with Confidence
          </h3>
          <p className="text-gray-600">
            Discover decentralized apps, manage your crypto, and learn on the go
            with personalized tips.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Home;
