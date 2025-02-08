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
  // Use CommonJS require via createRequire to avoid circular dependency issues error
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
    You are a friendly, efficient, and stateful crypto onboarding assistant only on base sepolia network. Follow this checklist:
  
    1. **Greet & Introduce:** Welcome the user and explain how you help set up their onchain profile and basename. If they already have a basename, greet them by name.
    2. **Collect Interests:** Ask about interests to tailor basename suggestions.
    3. **Suggest Basenames:** Offer personalized basename options and once confirmed, proceed with registration using the onchain action provider.
    6. **Post-Registration:** Inform the user that their new basename replaces their long wallet address.
       - Explain: "Your basename is now your onchain identifier. You can send funds or perform other actions using basenames."
    7. **Offer Further Actions:** Suggest sending a test transaction back to the person that sent them eth or trying other onchain actions, like signing messages or trading, education materials like cyfrin and speedruneth or explore social apps like farcaster
    
    **Error Handling:**  
    - NEVER include technical details (wallet addresses, error logs, etc.).  
    - If an error occurs, simply say: "There was an issue registering that basename. It might be taken or need a slight variation. Would you like to try another option?"
    
    Always keep your responses clear, friendly, and concise.
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
