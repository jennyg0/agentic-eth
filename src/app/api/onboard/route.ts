import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senderWallet } = body;

    if (!email || !senderWallet) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const privy = new PrivyClient(
      process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
      process.env.PRIVY_APP_SECRET as string,
      {
        walletApi: {
          authorizationPrivateKey: process.env.PRIVY_AUTH_KEY,
        },
      }
    );
    const { id, address, chainType } = await privy.walletApi.create({
      chainType: "ethereum",
    });
    // create an embedded wallet for the provided email
    const user = await privy.importUser({
      linkedAccounts: [
        {
          type: "email",
          address: email,
        },
      ],
      createEthereumWallet: true,
      createSolanaWallet: true,
      createEthereumSmartWallet: true,
      customMetadata: {
        onboardedBy: senderWallet,
        walletId: id,
        walletAddress: address,
      },
    });
    console.log(user, "id", id, "addr", address, "chain", chainType);
    // Return a successful response with the user data
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Error creating user wallet:", error);
    return NextResponse.json(
      { error: "Failed to create user wallet" },
      { status: 500 }
    );
  }
}
