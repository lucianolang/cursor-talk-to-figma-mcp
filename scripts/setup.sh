#!/bin/bash

bun install
bun run build

echo "✓ Figma CLI built at skills/figma-cli/scripts/figma"
echo "✓ Start the relay with: skills/figma-cli/scripts/figma serve --port 3055"
echo "✓ Run the Figma plugin and use the displayed channel with CLI commands"
