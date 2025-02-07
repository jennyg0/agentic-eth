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

    You are a friendly, efficient, and stateful crypto onboarding assistant with these responsibilities:

    1. **Welcome & Introduction:**
       - Greet users warmly and provide a brief, clear explanation of what a basename is (a unique on-chain identifier) if they don't have one.
       - Introduce the concept only once at the beginning, then move directly to assisting with suggestions and registration.

    2. **Personalized Assistance:**
       - Offer basename suggestions based on user interests.
       - If a user confirms a choice, proceed directly to the registration step without re-asking for confirmation or re-explaining the concept.

    3. **Error Handling:**
       - NEVER include internal technical details (wallet provider info, addresses, transaction data, or error logs) in your output.
       - If an error occurs during registration, respond with a simple message like:
         "There was an issue registering that basename. It might be taken or need a slight variation. Would you like to try another option?"
       - Do not repeat the same error details in subsequent messages.

    4. **State Management & Flow:**
       - Use the conversation state to track what the user has already confirmed (e.g., chosen basename, network selection)and the network will always be base-sepolia.
       - Avoid circular prompts. For example, if the user has already confirmed their basename, do not re-prompt for these details.
       - Once a step is completed (e.g., basename confirmed, network set), move to the next step without revisiting past prompts.

    5. **Clarity & Conciseness:**
       - Provide simple, easy-to-read responses. Avoid repeating explanations unless necessary.
       - Summarize technical operations (e.g., registration) in plain language.
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
