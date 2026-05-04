#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { startRelayServer } from "./relay";

type OutputFormat = "json" | "pretty";

type GlobalOptions = {
  server: string;
  channel?: string;
  timeout: number;
  outputFormat: OutputFormat;
  params?: string;
  paramsFile?: string;
  yes: boolean;
  port?: number;
  host: string;
  imageFormat?: "PNG" | "JPG" | "SVG" | "PDF";
  scale?: number;
};

const DESTRUCTIVE_COMMANDS = new Set([
  "delete_node",
  "delete_multiple_nodes",
  "delete_variables",
]);

function usage(exitCode = 0): never {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Figma CLI

Usage:
  figma serve [--port 3055] [--host 127.0.0.1]
  figma info --channel <channel> [--server localhost:3055]
  figma selection --channel <channel>
  figma read --channel <channel>
  figma node <nodeId> --channel <channel>
  figma nodes <nodeId...> --channel <channel>
  figma variables --channel <channel>
  figma collections --channel <channel>
  figma export <nodeId> --channel <channel> [--image-format PNG] [--scale 1]
  figma command <command-name> --channel <channel> [--params '{"nodeId":"1:2"}']

Global flags:
  --server <host[:port]|ws://url>  WebSocket relay address (default: localhost:3055)
  --channel <name>                 Figma plugin channel
  --timeout <ms>                   Inactivity timeout (default: 30000)
  --format <json|pretty>           Output format (default: pretty)
  --params <json>                  JSON parameters for generic command
  --params-file <path>             JSON parameter file for generic command
  --yes                            Confirm destructive commands
  --host <host>                    Relay bind host for serve (default: 127.0.0.1)
  --help                           Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const options: GlobalOptions = {
    server: "localhost:3055",
    timeout: 30000,
    outputFormat: "pretty",
    yes: false,
    host: "127.0.0.1",
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[++index];
      if (!next) throw new Error(`Missing value for ${flag}`);
      return next;
    };

    switch (flag) {
      case "--help":
      case "-h":
        usage(0);
      case "--server":
        options.server = readValue();
        break;
      case "--channel":
        options.channel = readValue();
        break;
      case "--timeout":
        options.timeout = Number(readValue());
        if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
          throw new Error("--timeout must be a positive number of milliseconds");
        }
        break;
      case "--format": {
        const format = readValue();
        if (format !== "json" && format !== "pretty") {
          throw new Error("--format must be json or pretty");
        }
        options.outputFormat = format;
        break;
      }
      case "--params":
        options.params = readValue();
        break;
      case "--params-file":
        options.paramsFile = readValue();
        break;
      case "--yes":
        options.yes = true;
        break;
      case "--port":
        options.port = Number(readValue());
        if (!Number.isInteger(options.port) || options.port <= 0) {
          throw new Error("--port must be a positive integer");
        }
        break;
      case "--host":
        options.host = readValue();
        break;
      case "--image-format": {
        const imageFormat = readValue().toUpperCase();
        if (!["PNG", "JPG", "SVG", "PDF"].includes(imageFormat)) {
          throw new Error("--image-format must be PNG, JPG, SVG, or PDF");
        }
        options.imageFormat = imageFormat as GlobalOptions["imageFormat"];
        break;
      }
      case "--scale":
        options.scale = Number(readValue());
        if (!Number.isFinite(options.scale) || options.scale <= 0) {
          throw new Error("--scale must be a positive number");
        }
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
  }

  return { positional, options };
}

function parseJsonParams(options: GlobalOptions): Record<string, unknown> {
  if (options.params && options.paramsFile) {
    throw new Error("Use either --params or --params-file, not both");
  }

  const raw = options.paramsFile
    ? fs.readFileSync(options.paramsFile, "utf8")
    : options.params;

  if (!raw) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Command params must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function toWebSocketUrl(server: string) {
  if (/^wss?:\/\//i.test(server)) return server;
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(server);
  return `${isLocal ? "ws" : "wss"}://${server}`;
}

function writeResult(result: unknown, format: OutputFormat) {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  if (typeof result === "string") {
    process.stdout.write(`${result}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function makeCommand(positional: string[], options: GlobalOptions) {
  const subcommand = positional[0];
  if (!subcommand) usage(1);

  switch (subcommand) {
    case "serve":
      return { command: "serve", params: {} };
    case "info":
      return { command: "get_document_info", params: {} };
    case "selection":
      return { command: "get_selection", params: {} };
    case "read":
      return { command: "read_my_design", params: {} };
    case "node": {
      const nodeId = positional[1];
      if (!nodeId) throw new Error("node requires <nodeId>");
      return { command: "get_node_info", params: { nodeId } };
    }
    case "nodes": {
      const nodeIds = positional.slice(1);
      if (nodeIds.length === 0) throw new Error("nodes requires at least one node ID");
      return { command: "get_nodes_info", params: { nodeIds } };
    }
    case "variables":
      return { command: "list_variables", params: {} };
    case "collections":
      return { command: "list_collections", params: {} };
    case "export": {
      const nodeId = positional[1];
      if (!nodeId) throw new Error("export requires <nodeId>");
      return {
        command: "export_node_as_image",
        params: {
          nodeId,
          format: options.imageFormat ?? "PNG",
          ...(options.scale ? { scale: options.scale } : {}),
        },
      };
    }
    case "command": {
      const command = positional[1];
      if (!command) throw new Error("command requires <command-name>");
      return { command, params: parseJsonParams(options) };
    }
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

async function sendCommandToFigma(
  command: string,
  params: Record<string, unknown>,
  options: GlobalOptions
) {
  if (!options.channel) {
    throw new Error("--channel is required unless you are running `figma serve`");
  }

  const url = toWebSocketUrl(options.server);
  const requestId = randomUUID();
  const joinId = randomUUID();

  return new Promise((resolve, reject) => {
    let joined = false;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const socket = new WebSocket(url);

    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        finish(new Error(`Timed out waiting for Figma response after ${options.timeout}ms`));
      }, options.timeout);
    };

    const finish = (error?: Error, result?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else resolve(result);
    };

    socket.on("open", () => {
      resetTimeout();
      socket.send(
        JSON.stringify({
          id: joinId,
          type: "join",
          channel: options.channel,
        })
      );
    });

    socket.on("message", (rawMessage) => {
      resetTimeout();

      const data = JSON.parse(rawMessage.toString());
      if (data.type === "error") {
        finish(new Error(data.message || "Relay returned an error"));
        return;
      }

      if (!joined && data.type === "system" && data.message?.id === joinId) {
        joined = true;
        socket.send(
          JSON.stringify({
            id: requestId,
            type: "message",
            channel: options.channel,
            message: {
              id: requestId,
              command,
              params: {
                ...params,
                commandId: requestId,
              },
            },
          })
        );
        return;
      }

      if (data.type === "progress_update" && data.message?.id === requestId) {
        const progress = data.message.data;
        if (progress?.message) {
          process.stderr.write(`[progress] ${progress.message}\n`);
        }
        return;
      }

      const response = data.message;
      if (response?.id !== requestId) return;

      if (response.error) {
        finish(new Error(response.error));
        return;
      }

      finish(undefined, response.result);
    });

    socket.on("error", (error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  const request = makeCommand(positional, options);

  if (request.command === "serve") {
    startRelayServer(options.port ?? 3055, options.host);
    return;
  }

  if (DESTRUCTIVE_COMMANDS.has(request.command) && !options.yes) {
    throw new Error(`${request.command} is destructive; re-run with --yes after inspecting the target`);
  }

  const result = await sendCommandToFigma(request.command, request.params, options);
  writeResult(result, options.outputFormat);
}

main().catch((error) => {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
