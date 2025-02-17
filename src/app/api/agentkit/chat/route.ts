import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { createRequire } from "module";
import { PrivyWalletProvider } from "./privyWalletProvider";
import { NillionMemorySaver } from "./nillionMemoryConfig";
import { SecretVaultWrapper } from "nillion-sv-wrappers";

dotenv.config();

const orgConfig = {
  // demo org credentials
  // in a production environment, make sure to put your org's credentials in environment variables
  credentials: {
    secretKey:
      "a786abe58f933e190d01d05b467838abb1e391007a674d8a3aef106e15a0bf5a",
    orgDid: "did:nil:testnet:nillion1vn49zpzgpagey80lp4xzzefaz09kufr5e6zq8c",
  },
  // demo node config
  nodes: [
    {
      url: "https://nildb-zy8u.nillion.network",
      did: "did:nil:testnet:nillion1fnhettvcrsfu8zkd5zms4d820l0ct226c3zy8u",
    },
    {
      url: "https://nildb-rl5g.nillion.network",
      did: "did:nil:testnet:nillion14x47xx85de0rg9dqunsdxg8jh82nvkax3jrl5g",
    },
    {
      url: "https://nildb-lpjp.nillion.network",
      did: "did:nil:testnet:nillion167pglv9k7m4gj05rwj520a46tulkff332vlpjp",
    },
  ],
};

const orgNillion = new SecretVaultWrapper(
  orgConfig.nodes,
  orgConfig.credentials
);

const newUserInstructions = `
You are a friendly crypto assistant helping users on the Base Sepolia network.

- When the user **does not have a registered basename**, guide them through creating one. Ask about their interests and suggest fun, personalized basename ideas.

- When the user **has a registered basename**, greet them by their basename and offer assistance with other onchain activities like sending transactions, checking balances, or learning about the blockchain.

**Do NOT suggest creating a basename if the user already has one.** Instead, continue to help them explore their onchain journey.

For example:
- After registering a basename, say: "🎉 Look at that—**basename** is way easier to read than that old wallet address! Now you're officially part of the blockchain club. 🥳 What would you like to do next?"
- If the user asks to send crypto, ensure the transaction goes through and **confirm success with a fun emoji reaction**.

Keep responses clear, friendly, and non-technical. Use emojis to make the experience engaging! 🚀
`;

const returningUserInstructions = `
You are a **friendly and helpful crypto assistant** on the Base Sepolia network.

When the session starts, greet the user by their **custom basename**:
"Hey **basename**! 👋 Welcome back to the crypto world. Ready to make some onchain magic today?"

For subsequent messages, skip the greeting and get straight to business.

Offer assistance with onchain activities like **trading, sending transactions, checking balances,** or **exploring decentralized apps (dApps)**. Always explain **why** you're suggesting an action and **how** it benefits the user.

For example:
- If they ask how much ETH they have, show them their balance in **ETH and USD**, and explain how gas fees work:
"🪙 You’ve got 0.2 ETH in your wallet—that’s around **$350**. Need help sending it or staking it? Oh, and don’t forget there’s a tiny gas fee (kind of like a postage stamp!) when you move crypto."

After successful transactions, **celebrate** with custom emoji reactions:
"🚀 Transaction complete! You’re moving through the blockchain like a pro! [Check it out on BaseScan](https://sepolia.basescan.org/tx/{txhash})."

If something goes wrong (like a failed transaction), stay calm and helpful:
"😅 Looks like that didn’t go through. It might be a gas fee issue or a typo in the address. Let’s double-check and try again!"

Keep responses **clear, concise, and friendly**. Avoid technical jargon unless the user asks, and always provide simple explanations for any complex terms.
`;

async function initializeAgent(metadata: any) {
  // Use CommonJS require via createRequire to avoid circular dependency issues
  const require = createRequire(import.meta.url);
  const agentkitModule = require("@coinbase/agentkit");
  const AgentKit = agentkitModule.AgentKit;
  const CdpWalletProvider = agentkitModule.CdpWalletProvider;
  const wethActionProvider = agentkitModule.wethActionProvider;
  const walletActionProvider = agentkitModule.walletActionProvider;
  const erc20ActionProvider = agentkitModule.erc20ActionProvider;
  const cdpApiActionProvider = agentkitModule.cdpApiActionProvider;
  const cdpWalletActionProvider = agentkitModule.cdpWalletActionProvider;
  const pythActionProvider = agentkitModule.pythActionProvider;
  const basenameActionProvider = agentkitModule.basenameActionProvider;

  const { getLangChainTools } = await import("@coinbase/agentkit-langchain");
  console.log(metadata, "meta");
  const walletId = metadata?.walletId;
  if (!walletId) {
    throw new Error("Missing wallet id in metadata");
  }

  // const walletProvider = await CdpWalletProvider.configureWithWallet(config);
  const walletProvider = await PrivyWalletProvider.configureWithWallet({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID as string,
    appSecret: process.env.PRIVY_APP_SECRET as string,
    networkId: "base-sepolia",
    walletId,
    authorizationKey: process.env.PRIVY_AUTH_KEY,
  });

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      basenameActionProvider(),
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      cdpApiActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME!,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n"
        ),
      }),
      cdpWalletActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME!,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n"
        ),
      }),
    ],
  });

  const tools = await getLangChainTools(agentkit);
  // Use a fresh memory for each conversation to avoid residual onboarding context
  // const memory = new NillionMemorySaver(
  //   orgNillion,
  //   "fe430061-82eb-4fef-bca7-94b5e5436fd0",
  //   walletId
  // );
  // await memory.loadMemory();
  const agentConfig = {
    configurable: { thread_id: "AgentKit Chatbot!" },
  };
  const memory = new MemorySaver();
  // Create the agent without a static messageModifier so we can pass our system message per request
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
    tools,
    checkpointSaver: memory,
  });

  return { agent, config: agentConfig };
}

interface SessionState {
  [key: string]: {
    hasWelcomed: boolean;
    basenameSuggested: boolean;
    basename?: string | null;
  };
}

const sessionState: SessionState = {};
export async function POST(request: Request) {
  try {
    const { userMessage, metadata, userId, baseName } = await request.json();

    if (!sessionState[userId]) {
      sessionState[userId] = {
        hasWelcomed: false,
        basenameSuggested: false,
        basename: baseName || null,
      };
    }

    const userSession = sessionState[userId];
    let messageToSend;
    console.log(userSession);
    if (!userSession.hasWelcomed) {
      if (userSession.basename) {
        messageToSend = `Hey **${userSession.basename}**! 👋 Welcome back to your crypto journey. What can I help you with today?`;
      } else {
        messageToSend =
          "🎉 Welcome to the world of crypto! I’m here to help you set up your onchain profile and make your first transactions effortless.";
      }
      userSession.hasWelcomed = true;
    } else if (
      !userSession.basename &&
      userMessage.toLowerCase().includes("successfully registered basename")
    ) {
      const basenameMatch = userMessage.match(
        /Successfully registered basename (\w+)/
      );
      if (basenameMatch) {
        userSession.basename = basenameMatch[1];
      }
      messageToSend = `🎉 Look at that—**${userSession.basename}** is way easier to read than that old wallet address! Now you're officially part of the blockchain club. 🥳 Ready to send your first transaction or check your balance?`;
    } else if (userSession.basename && !userSession.hasWelcomed) {
      messageToSend = `Hey **${userSession.basename}**! What can I assist you with today? You can send crypto, check your balance, or explore more onchain features! 🚀`;
      userSession.hasWelcomed = true;
    } else {
      messageToSend = `${userMessage}`;
    }

    const systemMessage = userSession.basename
      ? returningUserInstructions
      : newUserInstructions;
    const { agent, config } = await initializeAgent(metadata);

    const stream = await agent.stream(
      {
        messages: [
          { role: "system", content: systemMessage },
          new HumanMessage(messageToSend),
        ],
      },
      config
    );

    let fullResponse = "";
    for await (const chunk of stream) {
      if ("agent" in chunk && chunk.agent.messages?.[0]?.content) {
        fullResponse += chunk.agent.messages[0].content;
      } else if ("tools" in chunk && chunk.tools.messages?.[0]?.content) {
        fullResponse += chunk.tools.messages[0].content;
      }
    }
    return NextResponse.json({ response: fullResponse });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
