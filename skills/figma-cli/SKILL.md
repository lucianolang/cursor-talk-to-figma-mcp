---
name: figma-cli
description: Use the bundled `scripts/figma` CLI to inspect and modify the open Figma document through the local Figma plugin WebSocket relay. Trigger this skill when asked to read designs, inspect selections or nodes, export nodes, update text/layout/style, manage variables, or run Figma plugin commands from the terminal.
---

# Figma CLI

## Overview

Use the bundled CLI entrypoint [scripts/figma](scripts/figma) as the only command interface for Figma operations in this skill.
The CLI talks to the local WebSocket relay, which forwards commands to the Figma plugin running in the open Figma file.

Load [references/figma-commands.md](references/figma-commands.md) when you need concrete command templates or option reminders.

## Required Setup

1. Start the relay if it is not already running:

```bash
scripts/figma serve --port 3055
```

2. In Figma, run the Figma CLI plugin and connect to port `3055`.
3. Use the channel shown in the plugin UI for every CLI command.

## Workflow

### 1. Inspect before changing

- Start with `scripts/figma info --channel <channel>` to understand the document.
- Use `scripts/figma selection --channel <channel>` or `scripts/figma read --channel <channel>` before modifying selected content.
- Use `scripts/figma node <nodeId> --channel <channel>` before targeted node edits.

### 2. Execute narrow commands

- Prefer named read aliases for common inspection work.
- Use `scripts/figma command <command-name> --params '<json>' --channel <channel>` for the full Figma plugin command surface.
- Prefer batch commands for bulk changes, such as `set_multiple_text_contents`, `delete_multiple_nodes`, and `set_multiple_annotations`.

### 3. Guard destructive operations

- `delete_node`, `delete_multiple_nodes`, and `delete_variables` require `--yes`.
- Inspect exact targets before any destructive command.
- For broad mutations, summarize the intended target set before running the command.

### 4. Verify and report

- Re-read affected nodes or selection after writes.
- Return the command run, channel, affected node IDs, and key result fields.

## Guardrails

- Never invent a channel; use the channel shown by the Figma plugin.
- Never run mutating commands unless the plugin and relay are both connected.
- Never run destructive commands without exact IDs and prior inspection.
- Keep command output machine-readable with `--format json` when another tool will parse it.
- Use `scripts/figma serve --host 0.0.0.0` only when the relay must be reachable outside localhost.
