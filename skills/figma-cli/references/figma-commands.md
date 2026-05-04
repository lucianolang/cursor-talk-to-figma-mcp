# Figma CLI Commands

Use these templates with the bundled [scripts/figma](../scripts/figma) CLI.

## Relay

```bash
scripts/figma serve --port 3055
scripts/figma serve --port 3055 --host 0.0.0.0
```

## Read Commands

```bash
scripts/figma info --channel abc123 --format json
scripts/figma selection --channel abc123 --format json
scripts/figma read --channel abc123 --format json
scripts/figma node "1:2" --channel abc123 --format json
scripts/figma nodes "1:2" "1:3" --channel abc123 --format json
scripts/figma variables --channel abc123 --format json
scripts/figma collections --channel abc123 --format json
```

## Generic Command

```bash
scripts/figma command set_text_content \
  --channel abc123 \
  --params '{"nodeId":"1:2","text":"Hello"}'

scripts/figma command set_multiple_text_contents \
  --channel abc123 \
  --params '{"nodeId":"0:1","text":[{"nodeId":"1:2","text":"Hello"},{"nodeId":"1:3","text":"World"}]}'
```

## Export

```bash
scripts/figma export "1:2" --channel abc123 --image-format PNG --scale 2 --format json
scripts/figma export "1:2" --channel abc123 --image-format SVG --format json
```

## Layout And Style

```bash
scripts/figma command set_fill_color \
  --channel abc123 \
  --params '{"nodeId":"1:2","r":1,"g":0,"b":0,"a":1}'

scripts/figma command set_layout_mode \
  --channel abc123 \
  --params '{"nodeId":"1:2","layoutMode":"VERTICAL"}'

scripts/figma command set_padding \
  --channel abc123 \
  --params '{"nodeId":"1:2","paddingTop":16,"paddingRight":16,"paddingBottom":16,"paddingLeft":16}'
```

## Destructive Commands

Inspect exact targets before using `--yes`.

```bash
scripts/figma node "1:2" --channel abc123
scripts/figma command delete_node --channel abc123 --params '{"nodeId":"1:2"}' --yes

scripts/figma nodes "1:2" "1:3" --channel abc123
scripts/figma command delete_multiple_nodes --channel abc123 --params '{"nodeIds":["1:2","1:3"]}' --yes
```
