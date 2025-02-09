"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia } from "wagmi/chains"; // add baseSepolia for testing

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        // Customize Privy's appearance in your app
        // appearance: {
        //   theme: 'light',
        //   accentColor: '#676FFF',
        //   logo: 'https://your-logo-url',
        // },
        // Create embedded wallets for users who don't have a wallet
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <OnchainKitProvider
        apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
        chain={baseSepolia} // add baseSepolia for testing
      >
        {children}
      </OnchainKitProvider>
    </PrivyProvider>
  );
}
