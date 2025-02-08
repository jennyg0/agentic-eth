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

// Instructions for new users (no basename)
const newUserInstructions = `
You are a friendly, efficient, and stateful crypto onboarding assistant operating only on the Base Sepolia network.
Follow this checklist precisely:

1. **Greet & Introduce:** 
   - Welcome the user.
   - Explain that you help set up their onchain profile and create a custom basename.
2. **Collect Interests:** 
   - Ask the user about their interests to tailor a suggestion for a basename.
3. **Suggest Basenames:** 
   - Offer personalized basename options and guide the registration process.
4. **Post-Registration:** 
   - Inform the user that their new basename replaces their long wallet address.
5. **Offer Further Actions:** 
   - Suggest activities such as sending a test transaction, yield opportunities, staking, NFT exploration, or accessing educational resources.

**Error Handling:**  
- Never include technical details.
- On error, say: "There was an issue registering that basename. It might be taken or need a slight variation. Would you like to try another option?"

Always keep your responses clear, friendly, and concise. Use simple, non-technical language
`;

// Instructions for returning users (with a basename)
const returningUserInstructions = `
You are a friendly and knowledgeable crypto assistant on the Base Sepolia network.
Greet the user by their existing basename and assist them with their onchain activities.
When the user asks for information or actions, focus on tasks like trading, learning, or other onchain transactions.

Always keep your responses clear, friendly, and concise. Use simple, non-technical language. Provide visual aids and examples. Warn about common scams and risks. Emphasize the importance of wallet security. Break down complex concepts into digestible pieces.
If you can't perform the action, say that you're unable to help with that task and suggest a resource or alternative action.
`;

async function initializeAgent() {
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

  // Read stored wallet data if available.
  let walletDataStr;
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
  // Use a fresh memory for each conversation to avoid residual onboarding context
  const memory = new MemorySaver();
  const agentConfig = {
    configurable: { thread_id: "CDP AgentKit Chatbot Example!" },
  };

  // Create the agent without a static messageModifier so we can pass our system message per request
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
    tools,
    checkpointSaver: memory,
  });

  const exportedWallet = await walletProvider.exportWallet();
  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

  return { agent, config: agentConfig };
}

export async function POST(request: Request) {
  try {
    const { userMessage, userWallet, baseName } = await request.json();

    // Select system instructions based on whether the user already has a basename.
    const systemMessage = baseName
      ? returningUserInstructions
      : newUserInstructions;

    // Build a dynamic greeting message.
    let messageToSend;
    if (userMessage && userMessage.trim().length > 0) {
      messageToSend = userMessage;
    } else {
      if (!baseName) {
        messageToSend = `Hello, welcome! It looks like you haven’t set up your onchain profile yet. Could you tell me a bit about yourself? I can help suggest a base name and recommend strategies based on your interests.`;
      } else {
        messageToSend = `Welcome back, ${baseName}! How can I assist you today with your trading or onchain tasks?`;
      }
    }

    console.log("User wallet:", userWallet);
    const { agent, config } = await initializeAgent();

    // Provide both the system instructions and the user message as context for this conversation.
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
