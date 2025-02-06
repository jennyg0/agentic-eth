"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { usePrivy, useConnectWallet } from "@privy-io/react-auth";
import { parseUnits } from "viem";

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

  // Helper to trigger a transaction via the user's wallet
  const sendFunds = async (recipientAddress: string, amountEth: string) => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No wallet provider found");
    }
    try {
      // Convert the amount (ETH) to hex (wei in hex format)
      const valueHex = "0x" + parseUnits(amountEth, 18).toString(16);
      // Request the user's wallet to send the transaction
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

  // Handle onboarding then trigger the wallet transfer
  const handleOnboard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      // Call the onboarding API to create the new wallet
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

      // Extract the new wallet address from the response.
      const newUserWallet = onboardData.user?.wallet?.address;
      if (!newUserWallet) {
        setMessage("Onboarding error: No wallet address returned");
        setLoading(false);
        return;
      }

      // Trigger the transaction from the user's wallet
      const txHash = await sendFunds(newUserWallet, amount);
      setMessage(
        `User wallet created and funds sent! Transaction hash: ${txHash}`
      );
    } catch (error: any) {
      console.error("Onboarding error:", error);
      setMessage("Failed to onboard user or send funds");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Crypto Onboarding
        </h1>

        {!senderWallet && (
          <div className="flex justify-center mb-6">
            <button
              onClick={connectWallet}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md shadow hover:bg-blue-700 transition focus:outline-none"
            >
              Connect Wallet
            </button>
          </div>
        )}

        {senderWallet && (
          <div>
            <p className="text-center mb-6 text-gray-700">
              <span className="font-semibold">Connected Wallet:</span>{" "}
              {senderWallet}
            </p>
            <form onSubmit={handleOnboard} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-gray-700 mb-2">
                  Recipient Email:
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label htmlFor="amount" className="block text-gray-700 mb-2">
                  Amount (ETH):
                </label>
                <input
                  id="amount"
                  type="number"
                  step="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.001"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition focus:outline-none"
              >
                {loading ? "Processing..." : "Onboard & Send Funds"}
              </button>
            </form>
          </div>
        )}

        {message && (
          <p className="mt-6 text-center text-sm text-red-600">{message}</p>
        )}
      </div>
    </div>
  );
};

export default Home;
