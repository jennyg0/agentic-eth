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
      process.env.PRIVY_APP_SECRET as string
    );

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
      },
    });
    console.log(user);
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
