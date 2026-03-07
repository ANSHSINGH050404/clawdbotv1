# Building a Multi-Provider LLM CLI Bot: A Step-by-Step Guide

Hey there! As you grow from a junior to a mid-level or senior engineer, one of the most important concepts you'll learn is **abstraction**.

Right now, your bot is tightly coupled to a single provider (first OpenRouter, then Gemini). If we want to support OpenAI, Anthropic, Gemini, and others, we don't want to rewrite our core bot logic every time. Instead, we want our bot to talk to an "Interface" (a contract), and have individual adapters for each provider.

Here is the exact battle plan to refactor your codebase into a flexible, multi-provider architecture. Follow this step-by-step, taking it one file at a time.

---

### Step 1: Define the Universal Contract

**File to create/modify:** `src/api/types.ts` & `src/api/interface.ts`

**Why?**
Before writing any provider-specific code, you need to define exactly what your core message loop expects. The OpenAI Chat Completion schema is the industry standard.

- Define what a universal `ChatMessage` looks like.
- Define what a `ToolCall` looks like.
- Create an interface called `ILLMClient`. It should have one method: `streamChatCompletion(request)`.
- Every provider we build _must_ conform to this interface. This is the secret to building provider-agnostic systems.

### Step 2: Build the Provider Adapters

**Files to create:** `src/api/providers/openai.ts`, `src/api/providers/gemini.ts`, `src/api/providers/anthropic.ts`

**Why?**
Now that you have a contract (`ILLMClient`), you need to write classes that implement it.

- In your `gemini.ts` file, you'll take the universal schema passed in by the app, translate it to Google's specific format, call the Gemini SDK, and stream the results back out in the universal format.
- Do the exact same thing for OpenAI and Anthropic in their respective files.
- _Pro-tip:_ If a provider's SDK changes tomorrow, you only fix that specific adapter file. The rest of your bot remains untouched!

### Step 3: Create the Client Factory

**File to create:** `src/api/clientFactory.ts`

**Why?**
Your core application shouldn't care _how_ a GeminiClient or OpenAIClient gets created. It just wants a working client.

- Build a function like `createClient(providerName, apiKey)` that acts as a switchboard.
- If `providerName === 'gemini'`, it returns `new GeminiClient(apiKey)`.
- If `providerName === 'openai'`, it returns `new OpenAIClient(apiKey)`.
- This centralizes your instantiation logic.

### Step 4: The Core Agent Engine

**Files to update:** `src/core/query.ts` & `src/core/messageLoop.ts`

**Why?**
This is the brain of your bot.

- Update `query.ts` so its constructor accepts the generic `ILLMClient` interface instead of a specific `GeminiClient` class.
- The `messageLoop.ts` should remain almost entirely unchanged! Because it only relies on the universal types you defined in Step 1, it doesn't even know (and doesn't care) which AI provider is actually generating the text. This is the beauty of abstraction!

### Step 5: The Configuration & Environment Layer

**File to update:** `.env` & `src/config.ts` (create this)

**Why?**
You need to manage multiple API keys securely.

- Update your `.env` to hold `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Create a `src/config.ts` file to parse these variables cleanly, perhaps using Zod to ensure the required keys are present before the app even starts.

### Step 6: Interactive CLI Configuration

**File to modify:** `src/main.ts`

**Why?**
This is where the user experience begins.

- When the user runs the CLI, you should check your config file.
- Use the `commander` package to allow a `--provider` flag.
- If the user doesn't pass a flag, use an interactive prompt library (like `inquirer` or `@clack/prompts`) to ask them: _"Which AI provider would you like to use today?"_
- Once they select one, check if the corresponding API key exists in the `.env`. If it does, pass the provider name and key to your `clientFactory` (Step 3).
- If the key doesn't exist, gracefully prompt them to provide it and save it.

### Step 7: Hooking it to the UI

**File to modify:** `src/ui/App.tsx` & `src/ui/REPL.tsx`

**Why?**
Finally, pass the newly created, generic client instance into your React UI.

- The UI takes the client and feeds it to the `Conversation` class.
- Update your Header component to dynamically display which provider and model the user is currently chatting with.

---

### Final Senior Dev Advice to Keep in Mind:

1. **Don't rush to code.** Define your interfaces (types) first. If your types are clean, the implementations will write themselves.
2. **One responsibility per file.** A provider file should only talk to its respective API. The message loop should only handle looping. Separation of concerns makes bugs much easier to hunt down.
3. **Test as you go.** Build the OpenAI adapter first and get it working. Then move to Gemini. Don't try to build all three at the exact same time.

---

### How to Make it BETTER than Claude Code

Claude Code is Anthropic's flagship official CLI tool. It is an incredibly powerful agentic system, but as an open-source engineer, there are several architectural and UX areas where you can actually build a superior product for your specific use-case:

#### 1. Bring Your Own Model (BYOM)

**Claude Code's Flaw:** It is locked entirely into the Anthropic ecosystem (Claude 3.5 Sonnet, Haiku, etc.).
**The Upgrade:** By building the multi-provider abstraction we discussed above, your tool becomes model-agnostic. You can use Anthropic for coding, but switch to Gemini 2.5 Pro for massive context windows, or a local Ollama model (like DeepSeek Coder) for free, completely private, offline coding. Truly open agent systems win on flexibility.

#### 2. Robust Tool Handlers (Parallel Calling)

**Claude Code's Flaw:** While it does some parallelization, it heavily relies on sequential tool calls for safety. If it needs to read 5 files, it often reads them one by one.
**The Upgrade:** Use `Promise.allSettled()` in your `toolExecutor.ts` to execute multiple independent tool calls simultaneously. If an LLM asks to `grep` for "auth" and `read` a `package.json` at the same time, those should run in parallel, drastically reducing wait times.

#### 3. Customizable Agent Workflows & System Prompts

**Claude Code's Flaw:** The prompt logic and workflows are largely a black box. You cannot easily inject custom team-specific guidelines (e.g., "Always use Tailwind," "Never use nested ternaries") into the core agent loop.
**The Upgrade:** Implement a `.agentrc.json` or YAML file system in your project roots. When your CLI starts, it should read this local project config and dynamically append these rules to the `systemMessage`. This allows your agent to adopt the precise coding standards of whatever repository it is currently analyzing.

#### 4. Persistent Memory & Conversational Context

**Claude Code's Flaw:** Claude Code has a context window, but long-term memory between disparate sessions is limited. If you start a new session, it often forgets the architectural decisions you agreed upon yesterday.
**The Upgrade:** Introduce an SQLite or vector database (using something lightweight like `better-sqlite3` or `ChromaDB`) to save chat sessions and code embeddings. When the CLI starts, allow the user to run `--resume` to fetch the last `ChatMessage[]` array, or automatically inject a summary of the previous session natively into the new prompt.

#### 5. A Terminal UI (TUI) That Doesn't Break

**Claude Code's Flaw:** Sometimes long outputs from bash commands or large file reads can crowd the terminal, push the input box out of view, or ruin your ability to scroll back clearly through the "thought" process.
**The Upgrade:** Build a split-pane TUI using libraries like `blessed` or `react-blessed`, or lean heavier into `ink`'s advanced layout properties.

- Create a specific "Logs/Thinking" pane that is bounded and scrolls internally, so it doesn't pollute the main conversation view.
- Introduce a clean loading spinner (like `ora` or `ink-spinner`) next to the input while the LLM is "thinking", avoiding complete terminal freezes.

#### 6. Sandboxed Execution

**Claude Code's Flaw:** It runs commands directly on your bare-metal machine. If it hallucinates a bad `rm -rf` command and you accidentally approve it, your filesystem is gone.
**The Upgrade:** Integrate tools like `E2B` (e2b.dev) or Docker natively. When the agent asks to run `bash`, run it inside an isolated container by default. If it breaks something, it breaks the container, not your actual laptop. This provides absolute peace of mind.

By focusing on these areas—**Model Agnosticism**, **Custom Workflows**, **Persistent Memory**, and **Execution Safety**—you are no longer just building a CLI script; you are building an enterprise-grade, extensible developer platform.

Good luck! You've got this.
