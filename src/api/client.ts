import { GoogleGenAI } from "@google/genai";
import type { ChatCompletionRequest, ChatCompletionChunk } from "./types.js";

export class GeminiClient {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async *streamChatCompletion(
    request: ChatCompletionRequest,
  ): AsyncGenerator<ChatCompletionChunk> {
    const systemInstruction =
      request.messages.find((m) => m.role === "system")?.content || undefined;

    const contents: any[] = [];

    const sequence = request.messages.filter((m) => m.role !== "system");

    for (const m of sequence) {
      let role = m.role === "user" ? "user" : "model";
      const parts: any[] = [];

      if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
        if (m.content) parts.push({ text: m.content });
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          });
        }
      } else if (m.role === "tool") {
        role = "user";
        parts.push({
          functionResponse: {
            name: m.tool_name || m.tool_call_id || "unknown",
            response: {
              result: m.content || "success",
            },
          },
        });
      } else if (m.content) {
        parts.push({ text: m.content });
      } else {
        // Empty message? Skip
        continue;
      }

      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === role) {
        lastContent.parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }

    const tools = request.tools
      ? [
          {
            functionDeclarations: request.tools.map((t: any) => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters as any,
            })),
          },
        ]
      : undefined;

    const responseStream = await this.ai.models.generateContentStream({
      model:process.env.MODEL!,
      contents,
      config: {
        systemInstruction,
        tools: tools as any,
      },
    });

    for await (const chunk of responseStream) {
      let content = "";
      let tool_calls: any[] = [];

      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        for (const fc of chunk.functionCalls) {
          tool_calls.push({
            index: tool_calls.length,
            id: `call_${Math.random().toString(36).substring(2, 9)}`,
            type: "function",
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args),
            },
          });
        }
      }

      if (chunk.text) {
        content = chunk.text;
      }

      if (content || tool_calls.length > 0) {
        const returnedChunk: any = {
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion.chunk",
          created: Date.now(),
          model: request.model,
          choices: [
            {
              index: 0,
              delta: {
                content: content || null,
                tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
              },
              finish_reason: null,
            },
          ],
        };
        yield returnedChunk;
      }
    }

    const finalChunk: any = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Date.now(),
      model: request.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
    };
    yield finalChunk;
  }
}
