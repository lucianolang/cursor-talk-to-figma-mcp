# Figma CLI Bridge

Local CLI access to an open Figma file for AI agents and terminal workflows.

The CLI sends commands to a local WebSocket relay. The Figma plugin connects to the same relay and executes those commands inside Figma, where document APIs are available.

```text
Agent or terminal -> Figma CLI -> WebSocket relay -> Figma plugin -> Open Figma file
```

## Requirements

- Bun installed locally.
- Figma desktop or browser app with access to development plugins.
- This repository checked out on the same machine that can run the relay.

## Install

From the repository root:

```bash
bun install
bun run build
```

`bun run build` creates the local runnable files:

- `dist/figma.cjs`
- `skills/figma-cli/scripts/figma.bundle.cjs`

Those files are generated and ignored by git. Run `bun run build` again after changing CLI source.

## Quick Start

Use three separate contexts: one terminal for the relay, Figma for the plugin, and another terminal for commands.

### 1. Start The Relay

In terminal A:

```bash
skills/figma-cli/scripts/figma serve --port 3055
```

Leave this process running. A successful start prints a message like:

```text
WebSocket server running on 127.0.0.1:3055
```

You can also start the relay with:

```bash
bun socket
```

Use `--host 0.0.0.0` only when Figma must reach the relay from outside localhost, such as Docker or some WSL setups:

```bash
skills/figma-cli/scripts/figma serve --port 3055 --host 0.0.0.0
```

### 2. Link And Run The Figma Plugin

In Figma:

1. Open the target Figma file.
2. Go to `Plugins -> Development -> Link existing plugin`.
3. Select `src/figma_plugin/manifest.json`.
4. Run the development plugin named `Figma CLI Plugin`.
5. In the plugin UI, connect to port `3055`.
6. Copy the channel shown by the plugin.

The channel is required for every CLI command. Do not invent one; use the exact channel displayed in Figma.

The local development manifest intentionally has no published plugin `id`. Let Figma create the local development entry for your account.

### 3. Run CLI Commands

In terminal B, replace `abc123` with the channel from the plugin UI:

```bash
skills/figma-cli/scripts/figma info --channel abc123
skills/figma-cli/scripts/figma selection --channel abc123
skills/figma-cli/scripts/figma read --channel abc123
```

If another program will parse the output, add `--format json`:

```bash
skills/figma-cli/scripts/figma selection --channel abc123 --format json
```

## Common Commands

Read document and selection:

```bash
skills/figma-cli/scripts/figma info --channel abc123
skills/figma-cli/scripts/figma selection --channel abc123
skills/figma-cli/scripts/figma read --channel abc123
```

Inspect specific nodes:

```bash
skills/figma-cli/scripts/figma node "1:2" --channel abc123
skills/figma-cli/scripts/figma nodes "1:2" "1:3" --channel abc123
```

List variables and collections:

```bash
skills/figma-cli/scripts/figma variables --channel abc123
skills/figma-cli/scripts/figma collections --channel abc123
```

Export a node:

```bash
skills/figma-cli/scripts/figma export "1:2" --channel abc123 --image-format PNG --scale 2
```

Run any plugin command through the generic command entrypoint:

```bash
skills/figma-cli/scripts/figma command set_text_content \
  --channel abc123 \
  --params '{"nodeId":"1:2","text":"Hello"}'
```

Read parameters from a JSON file:

```bash
skills/figma-cli/scripts/figma command set_text_content \
  --channel abc123 \
  --params-file params.json
```

## Available CLI Aliases

- `serve` starts the WebSocket relay.
- `info` runs `get_document_info`.
- `selection` runs `get_selection`.
- `read` runs `read_my_design`.
- `node <nodeId>` runs `get_node_info`.
- `nodes <nodeId...>` runs `get_nodes_info`.
- `variables` runs `list_variables`.
- `collections` runs `list_collections`.
- `export <nodeId>` runs `export_node_as_image`.
- `command <command-name>` runs any supported plugin command with JSON params.

For more command templates, see `skills/figma-cli/references/figma-commands.md`.

## Safe Usage Rules

Inspect before modifying:

```bash
skills/figma-cli/scripts/figma selection --channel abc123
skills/figma-cli/scripts/figma node "1:2" --channel abc123
```

Destructive commands require `--yes`:

```bash
skills/figma-cli/scripts/figma command delete_node \
  --channel abc123 \
  --params '{"nodeId":"1:2"}' \
  --yes
```

These commands are guarded:

- `delete_node`
- `delete_multiple_nodes`
- `delete_variables`

Prefer batch commands for broad edits, such as `set_multiple_text_contents`, `delete_multiple_nodes`, and `set_multiple_annotations`.

## Troubleshooting

If `skills/figma-cli/scripts/figma` cannot find `figma.bundle.cjs`, run:

```bash
bun run build
```

If CLI commands time out:

- Confirm the relay process is still running.
- Confirm the Figma plugin shows connected status.
- Confirm the command uses the exact channel shown in the plugin.
- Confirm the plugin is running in the Figma file you want to inspect.

If Figma cannot connect to the relay:

- Confirm the relay is listening on port `3055`.
- Try restarting the relay and reconnecting the plugin.
- Use `--host 0.0.0.0` only when localhost is not reachable from Figma in your environment.

If a command fails with missing or invalid params:

- Check the command templates in `skills/figma-cli/references/figma-commands.md`.
- Use `--params '<json>'` for inline JSON.
- Use `--params-file <path>` for larger payloads.

## Development

Project structure:

- `src/figma_cli/` contains the TypeScript CLI and relay implementation.
- `src/socket.ts` is a compatibility relay entrypoint for `bun socket`.
- `src/figma_plugin/` contains Figma plugin runtime files.
- `skills/figma-cli/` contains the agent-facing skill wrapper and command reference.

Useful commands:

```bash
bun run build        # build dist/figma.cjs and the skill bundle
bun run dev          # watch CLI source and rebuild dist
bun socket           # start the relay through src/socket.ts
bun run start --help # show built CLI help
```

The Figma plugin is not bundled. Edit `src/figma_plugin/code.js` and `src/figma_plugin/ui.html` directly.

## License

MIT
