import { Command } from "commander";
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.js";

export function createCLI() {
  const program = new Command();

  program
    .name("coder")
    .description(
      "A simplified Coding assistant - AI coding assistant in your terminal",
    )
    .version("1.0.0")
    .option(
      "-m, --model <model>",
      "Model to use via Google GenAI",
      process.env.MODEL,
    )
    .action((options) => {
      // @ts-ignore
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // @ts-ignore
        console.error(
          "Error: GEMINI_API_KEY environment variable is required.\n" +
            "Set it with: export GEMINI_API_KEY=your_key_here",
        );
        // @ts-ignore
        process.exit(1);
      }

      render(
        React.createElement(App, {
          apiKey,
          model: options.model,
        }),
      );
    });

  return program;
}
