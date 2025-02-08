import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import { createRequire } from "module";
import { PrivyWalletProvider } from "./privyWalletProvider";

dotenv.config();

const newUserInstructions = `
You are a friendly and efficient crypto onboarding assistant on the Base Sepolia network.
When the conversation starts (i.e. there is no prior user input), greet the user with a brief welcome message and explain that you can help them set up their onchain profile by creating a custom basename—a simple, human-friendly identifier for their wallet. 
Explain that creating a basename requires a small on-chain transaction and a gas fee to register it.
Ask the user about their interests or hobbies, then suggest several personalized basename options based on their input.
Once the user picks a name, attempt to register it on-chain. If registration is successful, celebrate the new identifier by saying something like "Look at that—so much easier to read than your wallet address!" and guide them by suggesting that they try a small test transaction. For example, encourage them to send a little crypto to the address of the person who originally sent them funds (using their basename) to verify that everything works as expected.
If the registration fails (for example, if the name is taken or needs a slight tweak), gently prompt them to try another variation.
If the user provides further input after the initial welcome (such as questions or confirmations), respond directly to their input with clear, friendly instructions.
Keep your language clear, friendly, and non-technical.
`;

const returningUserInstructions = `
You are a helpful crypto assistant on the Base Sepolia network.
If this is the first interaction in the session, greet the user by their custom basename.
For subsequent messages, do not include an initial greeting—simply respond directly to the user's query or request.
Offer assistance with onchain activities such as trading, sending transactions, or exploring decentralized applications. 
Always explain why you're suggesting an action and how it benefits the user. 
Keep it simple and try to explain in terms that a non-crypto would understand. like if they ask how much money they have you can explain the eth about but also tell them how much in dollars it is.
Keep your responses clear, concise, and friendly, and provide simple explanations for any technical terms. 
Don't include object details like "Protocol Family: evm Network ID: base-sepolia"
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
  const memory = new MemorySaver();
  console.log("memory", memory);
  const agentConfig = {
    configurable: { thread_id: "CDP AgentKit Chatbot Example!" },
  };

  // Create the agent without a static messageModifier so we can pass our system message per request
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
    tools,
    checkpointSaver: memory,
  });

  return { agent, config: agentConfig };
}

export async function POST(request: Request) {
  try {
    const { userMessage, userWallet, baseName, metadata, stage } =
      await request.json();

    // Pick the system instructions based on whether a basename exists.
    const systemMessage = baseName
      ? returningUserInstructions
      : newUserInstructions;

    // If there's no user message, assume this is the start of the conversation.
    // let messageToSend;
    // console.log(userMessage, stage);
    // if (
    //   !userMessage ||
    //   (userMessage.trim() === "" && stage === "welcomemessage")
    // ) {
    //   if (baseName) {
    //     messageToSend = `Welcome back, ${baseName}! How can I assist you today with your onchain tasks?`;
    //   } else {
    //     messageToSend = `Hello, welcome! It looks like you haven’t set up your onchain profile yet. Could you tell me a bit about yourself? I can help suggest a custom basename that fits your interests.`;
    //   }
    // } else {
    //   // If there is a user message, simply pass it along.
    //   messageToSend = userMessage;
    // }

    // Initialize the agent (using your existing initialization code).
    const { agent, config } = await initializeAgent(metadata);

    // Pass the system message along with the message to send.
    const stream = await agent.stream(
      {
        messages: [
          { role: "system", content: systemMessage },
          new HumanMessage(userMessage),
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
