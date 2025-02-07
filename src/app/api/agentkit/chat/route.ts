import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { createRequire } from "module";

dotenv.config();
const WALLET_DATA_FILE = "wallet_data.txt";

async function initializeAgent() {
  // Use CommonJS require via createRequire to avoid circular dependency issues.
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

  const { getLangChainTools } = await import("@coinbase/agentkit-langchain");

  // Read stored wallet data if available.
  let walletDataStr: string | undefined;
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    } catch (error) {
      console.error("Error reading wallet data:", error);
    }
  }

  // Configure wallet provider using environment variables.
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

  const tools = await getLangChainTools(agentkit);
  const memory = new MemorySaver();
  const agentConfig = {
    configurable: { thread_id: "CDP AgentKit Chatbot Example!" },
  };

  const agent = createReactAgent({
    llm: new ChatOpenAI({
      model: "gpt-4o-mini",
    }),
    tools,
    checkpointSaver: memory,
    messageModifier: `
      You are a helpful onchain assistant with the ability to advise users on trading strategies, getting a basename and education onboarding into crypto.
      Explain concepts when necessary and perform onchain operations using the AgentKit when asked by the user.
      Your response should change based on the information the user has provided and is stored in their profile. 
      For new users, invite them to share more about themselves so you can provide personalized suggestions.
      Don't ask them to set up a wallet because they already have one but you can teach them about different types of wallets and guide them to options.
      You will guide them through learning and onboarding into the crypto space by providing educational content and answering their questions as well as making sure they have a basename setup and know how to send transactions to other basenames.
    `,
  });

  const exportedWallet = await walletProvider.exportWallet();
  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

  return { agent, config: agentConfig };
}

export async function POST(request: Request) {
  try {
    const { userMessage, userWallet, baseName } = await request.json();

    // Build a dynamic welcome message if userMessage is empty.
    let messageToSend: string;
    if (userMessage && userMessage.trim().length > 0) {
      messageToSend = userMessage;
    } else {
      if (!baseName) {
        // First-time user or user hasn't provided additional info.
        messageToSend =
          "Hello, welcome! It looks like you haven’t set up your onchain profile yet. Could you tell me a bit about yourself? I can help suggest a base name and recommend trading strategies based on your preferences.";
      } else {
        // Returning user with profile info.
        messageToSend = `Welcome back, ${baseName}! How can I assist you today with your trading or onchain tasks?`;
      }
    }

    console.log("User wallet:", userWallet);
    const { agent, config } = await initializeAgent();

    const stream = await agent.stream(
      { messages: [new HumanMessage(messageToSend)] },
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
