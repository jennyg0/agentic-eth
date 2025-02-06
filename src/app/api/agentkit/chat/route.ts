import { NextResponse } from "next/server";
import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// This file will be used to persist your agent’s wallet data.
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initializes the Coinbase AgentKit agent.
 * Uses your wallet provider configuration and agentkit action providers.
 */
async function initializeAgent() {
  // Read existing wallet data from file if available.
  let walletDataStr: string | undefined;
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    } catch (error) {
      console.error("Error reading wallet data:", error);
    }
  }

  // Configure your wallet provider.
  const config = {
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n"
    ),
    cdpWalletData: walletDataStr || undefined,
    networkId: process.env.NETWORK_ID || "base-sepolia",
  };

  const walletProvider = await CdpWalletProvider.configureWithWallet(config);

  // Initialize AgentKit with the wallet provider and action providers.
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
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

  // Get LangChain tools from AgentKit.
  const tools = await getLangChainTools(agentkit);

  // Use in-memory storage for conversation history.
  const memory = new MemorySaver();
  const agentConfig = {
    configurable: { thread_id: "CDP AgentKit Chatbot Example!" },
  };

  // Create the agent using your Coinbase AgentKit configuration.
  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "gpt-4o-mini",
    }),
    tools,
    checkpointSaver: memory,
    messageModifier: `
      You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit.
      You have access to several tools that let you perform onchain operations.
      If you ever need funds, you can request them from the faucet if you are on network 'base-sepolia'.
      If a request cannot be fulfilled due to missing capabilities, kindly explain what is missing.
      Please be concise and clear in your responses.
    `,
  });

  // Export and persist wallet data.
  const exportedWallet = await walletProvider.exportWallet();
  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

  return { agent, config: agentConfig };
}

/**
 * API Route POST handler.
 *
 * Expects a JSON body with:
 * - `userMessage` (optional): The message from the user.
 * - `userWallet` (optional): The user's wallet address.
 *
 * If no userMessage is provided (or if it’s empty after trimming), a starting greeting is used.
 */
export async function POST(request: Request) {
  try {
    const { userMessage, userWallet } = await request.json();

    // If no user message is provided, use a default starting greeting.
    const messageToSend =
      userMessage && userMessage.trim().length > 0
        ? userMessage
        : "Hello! I'm your onchain assistant powered by Coinbase AgentKit. How can I help you today?";

    // (Optionally) you can log the user's wallet address if needed.
    console.log("User wallet:", userWallet);

    // Initialize the agent (or retrieve a cached instance in production).
    const { agent, config } = await initializeAgent();

    // Send the (starting) message to the agent.
    const stream = await agent.stream(
      { messages: [new HumanMessage(messageToSend)] },
      config
    );

    // Collect the streamed response.
    let fullResponse = "";
    for await (const chunk of stream) {
      if ("agent" in chunk && chunk.agent.messages?.[0]?.content) {
        fullResponse += chunk.agent.messages[0].content;
      } else if ("tools" in chunk && chunk.tools.messages?.[0]?.content) {
        fullResponse += chunk.tools.messages[0].content;
      }
    }

    // Return the agent's response.
    return NextResponse.json({ response: fullResponse });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
