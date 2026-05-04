# CLAUDE.md

This repository exposes Figma automation through a skill-friendly CLI wrapper, not a stdio integration.

## Development Commands

```bash
bun install
bun run build
bun run dev
bun socket
bun run start --help
```

`bun run build` produces both `dist/figma.cjs` and `skills/figma-cli/scripts/figma.bundle.cjs`.

## Runtime Flow

```
Agent skill CLI -> Figma CLI -> WebSocket Relay -> Figma Plugin
```

Use `skills/figma-cli/scripts/figma` for agent workflows:

```bash
skills/figma-cli/scripts/figma serve --port 3055
skills/figma-cli/scripts/figma info --channel <channel>
skills/figma-cli/scripts/figma command set_text_content --channel <channel> --params '{"nodeId":"1:2","text":"Hello"}'
```

The Figma plugin displays the channel after it connects to the relay. Always inspect the document or selection before making changes.
