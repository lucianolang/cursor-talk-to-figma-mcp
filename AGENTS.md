# AGENTS.md

This file guides agents working in this repository.

## Project Overview

Figma CLI bridge for local AI agents. Three components communicate in a pipeline:

```
Agent skill CLI -> Figma CLI -> WebSocket Relay -> Figma Plugin
```

The Figma plugin remains required because Figma document APIs are only available inside the plugin sandbox.

## Build & Development Commands

```bash
bun install              # Install dependencies
bun run build            # Build CLI and bundled skill wrapper
bun run dev              # Build CLI in watch mode
bun socket               # Start WebSocket relay server (port 3055)
bun run start --help     # Run built CLI
bun setup                # Install dependencies and build the skill CLI
```

There is no test suite or linter configured.

## Architecture

### CLI (`src/figma_cli/cli.ts`)

The main command-line interface. It exposes aliases such as `info`, `selection`, `read`, `node`, `nodes`, `variables`, `collections`, `export`, and a generic `command <command-name> --params <json>` entrypoint for the full plugin command surface.

### WebSocket Relay (`src/figma_cli/relay.ts`, `src/socket.ts`)

Channel-isolated relay on port `3055` by default. Clients join a channel, and messages are broadcast only to peers in that channel. The CLI and Figma plugin use the same protocol:

```json
{ "type": "message", "channel": "abc123", "message": { "id": "...", "command": "get_selection", "params": {} } }
```

### Skill (`skills/figma-cli/`)

Agent-facing wrapper modeled after `confluence-cli`. Use `skills/figma-cli/scripts/figma` as the skill command. `bun run build` generates `skills/figma-cli/scripts/figma.bundle.cjs`.

### Figma Plugin (`src/figma_plugin/`)

Runs inside Figma. `code.js` handles plugin commands via a dispatcher. `ui.html` manages WebSocket connection and shows the channel to use in CLI commands. The plugin is not bundled; edit these files directly.
The local development manifest intentionally omits a published plugin `id`; do not add a Community plugin ID unless publishing/owning that plugin.

## Key Patterns

- **Channels**: Always use the channel shown in the Figma plugin UI.
- **Colors**: Figma uses RGBA 0-1 floats.
- **Output**: CLI command results go to stdout; progress and errors go to stderr.
- **Timeouts**: 30s default inactivity timeout. Progress updates reset the CLI wait timer.
- **Chunking**: Large operations can send progress updates so Figma stays responsive.
- **Destructive guards**: `delete_node`, `delete_multiple_nodes`, and `delete_variables` require `--yes`.

## Setup

1. Run `bun setup`.
2. Start the relay with `skills/figma-cli/scripts/figma serve --port 3055` or `bun socket`.
3. In Figma: Plugins -> Development -> Link existing plugin -> select `src/figma_plugin/manifest.json`.
4. Run the plugin in Figma, connect to port `3055`, and copy the channel.
5. Use skill commands such as `skills/figma-cli/scripts/figma info --channel <channel>`.

## Agent Notes

- Start with `info`, then `selection` or `read` before making modifications.
- Use `node` or `nodes` to inspect exact targets before targeted edits.
- Prefer batch operations (`set_multiple_text_contents`, `delete_multiple_nodes`, `set_multiple_annotations`) over repeated single-node commands.
- Use `command <name> --params '<json>'` for commands without a dedicated alias.
- Inspect exact IDs before destructive commands and pass `--yes` only after scope is clear.
- The plugin and relay must both be running before Figma commands can succeed.
