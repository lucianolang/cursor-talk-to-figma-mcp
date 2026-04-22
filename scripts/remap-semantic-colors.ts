type CollectionMode = {
  modeId: string;
  name: string;
};

type VariableCollection = {
  id: string;
  name: string;
  key: string;
  description?: string;
  defaultModeId?: string;
  modes: CollectionMode[];
};

type AliasInfo = {
  id: string;
  name: string | null;
  variableCollectionId: string | null;
  targetModeId?: string;
  aliasChain?: AliasInfo[];
};

type VariableValue =
  | { r: number; g: number; b: number; a?: number }
  | { type: "VARIABLE_ALIAS"; id: string }
  | string
  | number
  | boolean
  | null;

type VariableRecord = {
  id: string;
  name: string;
  key: string;
  variableCollectionId?: string;
  collectionName?: string | null;
  resolvedType: "FLOAT" | "STRING" | "BOOLEAN" | "COLOR";
  valuesByMode: Record<string, VariableValue>;
  resolvedValuesByMode?: Record<string, VariableValue>;
  aliasInfoByMode?: Record<string, AliasInfo>;
  resolutionErrorsByMode?: Record<string, string>;
  scopes?: string[];
  description?: string;
};

type BridgeMessage =
  | { id?: string; type: "system"; message: string | { id?: string; result?: unknown }; channel?: string }
  | { id?: string; type: "error"; message: string }
  | { id?: string; type: "broadcast"; message: { id: string; result?: unknown; error?: string } };

type MatchMethod = "exact-color" | "name-inferred" | "needs-input";

type MappingResult = {
  sourceId: string;
  sourceName: string;
  currentAliasNames: string[];
  matchMethod: MatchMethod;
  targetId: string | null;
  targetName: string | null;
  notes: string[];
};

const NOMENCLATURE = {
  pageId: "2656731550",
  title: "DS Token Nomenclature",
  where: new Set(["background", "text", "border", "icon", "foreground"]),
  groups: new Set(["accent", "neutral", "positive", "negative", "attention"]),
  modes: new Set([
    "default",
    "light",
    "lighter",
    "medium",
    "emphasis",
    "disabled",
    "limit",
    "context",
    "inverse",
  ]),
  groupOptionalModes: new Set(["default", "disabled", "limit", "context", "inverse"]),
};

const REVIEWED_TARGET_BY_SOURCE_NAME: Record<string, string> = {
  "Background/Default": "Backgrounds/Primary",
  "Background/Inverse/Default": "Backgrounds/Inverted",
  "Background/Attention/Default": "Colors/Orange",
  "Background/Attention/Emphasis": "Colors/Orange",
  "Background/Positive/Default": "Colors/Green",
  "Background/Positive/Emphasis": "Colors/Green",
  "Background/Negative/Light": "Colors/Red",
  "Background/Negative/Default": "Colors/Red",
  "Background/Negative/Emphasis": "Colors/Red",
  "Background/Disabled": "Backgrounds/Tertiary",
  "Background/Limit": "Backgrounds/Secondary",
  "Background/Context": "Backgrounds (Grouped)/Secondary",
  "Background/Home": "Backgrounds/Tertiary",
  "Background/Accent/Lighter": "Colors/Accent",
  "Background/Accent/Emphasis": "Colors/Accent",
  "Border/Default": "Separators/Opaque",
  "Border/Negative/Default": "Colors/Red",
  "Border/Negative/Emphasis": "Colors/Red",
  "Border/Inverse/Default": "Grays/Gray 2",
  "Border/Positive/Default": "Separators/Opaque",
  "Border/Attention/Default": "Separators/Non-opaque",
  "Border/Dark": "Grays/Gray 2",
  "Foreground/Attention/Default": "Colors/Orange",
  "Foreground/Positive/Default": "Colors/Green",
  "Foreground/Negative/Default": "Colors/Red",
  "Foreground/Accent/Emphasis": "Colors/Accent",
  "Foreground/Context": "Grays/Gray 2",
  "Foreground/Disabled": "Labels/Quaternary",
  "Icon/Default": "Labels/Primary",
  "Icon/Inverse/Emphasis": "Grays/White",
  "Icon/Inverse/Default": "Grays/White",
  "Icon/Context": "Grays/Gray 2",
  "Icon/Positive/Default": "Colors/Green",
  "Icon/Disabled": "Labels/Quaternary",
  "Icon/Accent/Default": "Colors/Accent",
  "Icon/Negative/Default": "Colors/Red",
  "Icon/Negative/Emphasis": "Colors/Red",
  "Shadow/Soft": "Fills/Secondary",
  "Shadow/Hard": "Fills/Primary",
  "Text/Default": "Labels/Primary",
  "Text/Inverse/Default": "Grays/White",
  "Text/Disabled": "Labels/Quaternary",
  "Text/Context": "Labels/Tertiary",
  "Text/Accent/Emphasis": "Colors/Accent",
  "Text/Negative/Default": "Colors/Red",
  "Text/Negative/Emphasis": "Colors/Red",
  "Text/Positive/Default": "Colors/Green",
  "Text/Attention/Default": "Colors/Orange",
  "Alert/Icon": "Labels/Primary",
  "Alert/Background": "Backgrounds/Primary",
  "Alert/Text/Title": "Labels/Primary",
  "Alert/Text/Body": "Labels/Primary",
  "ContextualHero/Background/Default": "Colors/Accent",
  "ContextualHero/Background/Positive": "Colors/Green",
  "Graphitem/Foreground/Default": "Labels/Primary",
  "Graphitem/Foreground/Positive": "Colors/Green",
  "Graphitem/Foreground/Attention": "Colors/Orange",
  "Graphitem/Foreground/Negative": "Colors/Red",
  "Graphitem/Background/Default": "Backgrounds/Secondary",
  "Screen/Splash/Text": "Grays/White",
  "Screen/Splash/Background": "Backgrounds/Inverted",
  "Screen/Welcome/Background": "Backgrounds/Primary",
  "Screen/Welcome/Text": "Labels/Primary",
};

function parseArgs(argv: string[]) {
  const options = {
    channel: "",
    host: "ws://127.0.0.1:3055",
    sourceCollection: "Semantics - Migration",
    targetCollection: "01. Colors",
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = argv[index + 1];

    if (arg === "--channel") {
      options.channel = nextValue ?? "";
      index += 1;
    } else if (arg === "--host") {
      options.host = nextValue ?? options.host;
      index += 1;
    } else if (arg === "--source-collection") {
      options.sourceCollection = nextValue ?? options.sourceCollection;
      index += 1;
    } else if (arg === "--target-collection") {
      options.targetCollection = nextValue ?? options.targetCollection;
      index += 1;
    } else if (arg === "--apply") {
      options.apply = true;
    }
  }

  if (!options.channel) {
    throw new Error("Missing required --channel argument");
  }

  return options;
}

class BridgeClient {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void; timeout: ReturnType<typeof setTimeout> }>();
  private joined = false;

  constructor(private readonly host: string, private readonly channel: string) {}

  async connect() {
    if (this.ws && this.joined) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.host);
      const joinId = `join-${Date.now()}`;
      const joinTimeout = setTimeout(() => {
        reject(new Error(`Timed out joining channel ${this.channel}`));
      }, 30000);

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "join", channel: this.channel, id: joinId }));
      });

      ws.addEventListener("message", (event) => {
        const payload = JSON.parse(String(event.data)) as BridgeMessage;
        const message = payload.message;

        if (
          !this.joined &&
          payload.type === "system" &&
          ((typeof message === "string" && message.includes(`Joined channel: ${this.channel}`)) ||
            (typeof message === "object" && message?.result))
        ) {
          clearTimeout(joinTimeout);
          this.joined = true;
          this.ws = ws;
          resolve();
          return;
        }

        if (payload.type === "broadcast" && this.pending.has(payload.message.id)) {
          const pending = this.pending.get(payload.message.id)!;
          clearTimeout(pending.timeout);
          this.pending.delete(payload.message.id);
          if (payload.message.error) {
            pending.reject(new Error(payload.message.error));
          } else {
            pending.resolve(payload.message.result);
          }
          return;
        }

        if (payload.type === "error") {
          clearTimeout(joinTimeout);
          reject(new Error(payload.message));
        }
      });

      ws.addEventListener("error", () => {
        clearTimeout(joinTimeout);
        reject(new Error(`Failed to connect to ${this.host}`));
      });

      ws.addEventListener("close", () => {
        this.joined = false;
        this.ws = null;
      });
    });
  }

  async command<T>(command: string, params: Record<string, unknown> = {}) {
    await this.connect();

    return await new Promise<T>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error("WebSocket is not connected"));
        return;
      }

      const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${command}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(
        JSON.stringify({
          id,
          type: "message",
          channel: this.channel,
          message: {
            id,
            command,
            params: {
              ...params,
              commandId: id,
            },
          },
        })
      );
    });
  }
}

function normalizeSegment(segment: string) {
  return segment
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "-")
    .replace(/labels?/g, "text")
    .replace(/backgrounds?/g, "background")
    .replace(/borders?/g, "border")
    .replace(/icons?/g, "icon")
    .replace(/foregrounds?/g, "foreground");
}

function parseSemanticName(name: string) {
  const segments = name.split("/").map(normalizeSegment).filter(Boolean);
  const where = segments.find((segment) => NOMENCLATURE.where.has(segment)) ?? null;
  const group = segments.find((segment) => NOMENCLATURE.groups.has(segment)) ?? null;
  const mode = segments.find((segment) => NOMENCLATURE.modes.has(segment)) ?? null;
  return {
    originalName: name,
    normalizedName: segments.join("/"),
    where,
    group,
    mode,
  };
}

function isColorValue(value: VariableValue | undefined | null): value is { r: number; g: number; b: number; a?: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "r" in value &&
      "g" in value &&
      "b" in value
  );
}

function isSameColor(left: VariableValue | undefined | null, right: VariableValue | undefined | null) {
  if (!isColorValue(left) || !isColorValue(right)) {
    return false;
  }

  const leftAlpha = left.a ?? 1;
  const rightAlpha = right.a ?? 1;
  return (
    Math.abs(left.r - right.r) < 0.000001 &&
    Math.abs(left.g - right.g) < 0.000001 &&
    Math.abs(left.b - right.b) < 0.000001 &&
    Math.abs(leftAlpha - rightAlpha) < 0.000001
  );
}

function getModeIdForTarget(
  sourceCollection: VariableCollection,
  sourceModeId: string,
  targetCollection: VariableCollection,
  targetVariable: VariableRecord
) {
  if (targetVariable.resolvedValuesByMode?.[sourceModeId]) {
    return sourceModeId;
  }

  const sourceModeName = sourceCollection.modes.find((mode) => mode.modeId === sourceModeId)?.name.trim().toLowerCase();
  if (sourceModeName) {
    const nameMatch = targetCollection.modes.find(
      (mode) =>
        mode.name.trim().toLowerCase() === sourceModeName &&
        targetVariable.resolvedValuesByMode?.[mode.modeId]
    );
    if (nameMatch) {
      return nameMatch.modeId;
    }
  }

  if (targetCollection.defaultModeId && targetVariable.resolvedValuesByMode?.[targetCollection.defaultModeId]) {
    return targetCollection.defaultModeId;
  }

  return Object.keys(targetVariable.resolvedValuesByMode ?? {})[0] ?? sourceModeId;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function inferByName(source: VariableRecord, candidates: VariableRecord[]) {
  const sourceParts = parseSemanticName(source.name);
  const aliasNames = uniqueStrings(
    Object.values(source.aliasInfoByMode ?? {}).flatMap((alias) =>
      [alias.name, ...(alias.aliasChain ?? []).map((chainEntry) => chainEntry.name)]
    )
  );

  const exactNameMatches = candidates.filter(
    (candidate) => parseSemanticName(candidate.name).normalizedName === sourceParts.normalizedName
  );
  if (exactNameMatches.length === 1) {
    return exactNameMatches;
  }

  const whereGroupModeMatches = candidates.filter((candidate) => {
    const candidateParts = parseSemanticName(candidate.name);
    return (
      sourceParts.where &&
      sourceParts.group &&
      sourceParts.mode &&
      candidateParts.where === sourceParts.where &&
      candidateParts.group === sourceParts.group &&
      candidateParts.mode === sourceParts.mode
    );
  });
  if (whereGroupModeMatches.length === 1) {
    return whereGroupModeMatches;
  }

  const whereModeMatches = candidates.filter((candidate) => {
    const candidateParts = parseSemanticName(candidate.name);
    return (
      sourceParts.where &&
      sourceParts.mode &&
      NOMENCLATURE.groupOptionalModes.has(sourceParts.mode) &&
      candidateParts.where === sourceParts.where &&
      candidateParts.mode === sourceParts.mode
    );
  });
  if (whereModeMatches.length === 1) {
    return whereModeMatches;
  }

  const aliasNameMatches = candidates.filter((candidate) =>
    aliasNames.includes(candidate.name)
  );
  return aliasNameMatches;
}

function inferByReviewedMapping(
  source: VariableRecord,
  targetVariables: VariableRecord[]
) {
  const targetName = REVIEWED_TARGET_BY_SOURCE_NAME[source.name];
  if (!targetName) {
    return null;
  }

  return targetVariables.find((candidate) => candidate.name === targetName) ?? null;
}

function buildMapping(
  sourceVariables: VariableRecord[],
  targetVariables: VariableRecord[],
  collectionsById: Map<string, VariableCollection>
) {
  const mappings: MappingResult[] = [];

  for (const sourceVariable of sourceVariables) {
    const notes: string[] = [];
    const sourceCollection = collectionsById.get(sourceVariable.variableCollectionId ?? "");
    if (!sourceCollection) {
      mappings.push({
        sourceId: sourceVariable.id,
        sourceName: sourceVariable.name,
        currentAliasNames: [],
        matchMethod: "needs-input",
        targetId: null,
        targetName: null,
        notes: ["Missing source collection metadata"],
      });
      continue;
    }

    const currentAliasNames = uniqueStrings(
      Object.values(sourceVariable.aliasInfoByMode ?? {}).flatMap((alias) =>
        [alias.name, ...(alias.aliasChain ?? []).map((chainEntry) => chainEntry.name)]
      )
    );

    const exactMatches = targetVariables.filter((targetVariable) => {
      const targetCollection = collectionsById.get(targetVariable.variableCollectionId ?? "");
      if (!targetCollection) {
        return false;
      }

      for (const sourceModeId of Object.keys(sourceVariable.resolvedValuesByMode ?? {})) {
        const targetModeId = getModeIdForTarget(sourceCollection, sourceModeId, targetCollection, targetVariable);
        if (
          !isSameColor(
            sourceVariable.resolvedValuesByMode?.[sourceModeId],
            targetVariable.resolvedValuesByMode?.[targetModeId]
          )
        ) {
          return false;
        }
      }

      return true;
    });

    if (exactMatches.length === 1) {
      mappings.push({
        sourceId: sourceVariable.id,
        sourceName: sourceVariable.name,
        currentAliasNames,
        matchMethod: "exact-color",
        targetId: exactMatches[0].id,
        targetName: exactMatches[0].name,
        notes,
      });
      continue;
    }

    if (exactMatches.length > 1) {
      notes.push(`Multiple exact color matches: ${exactMatches.map((candidate) => candidate.name).join(", ")}`);
    } else {
      notes.push("No exact color match found in target collection");
    }

    const nameCandidates = inferByName(
      sourceVariable,
      exactMatches.length > 0 ? exactMatches : targetVariables
    );

    if (nameCandidates.length === 1) {
      mappings.push({
        sourceId: sourceVariable.id,
        sourceName: sourceVariable.name,
        currentAliasNames,
        matchMethod: "name-inferred",
        targetId: nameCandidates[0].id,
        targetName: nameCandidates[0].name,
        notes,
      });
      continue;
    }

    if (nameCandidates.length > 1) {
      notes.push(`Name inference is still ambiguous: ${nameCandidates.map((candidate) => candidate.name).join(", ")}`);
    } else {
      notes.push("Name inference found no unique target");
    }

    const reviewedTarget = inferByReviewedMapping(sourceVariable, targetVariables);
    if (reviewedTarget) {
      notes.push(`Using reviewed fallback mapping to ${reviewedTarget.name}`);
      mappings.push({
        sourceId: sourceVariable.id,
        sourceName: sourceVariable.name,
        currentAliasNames,
        matchMethod: "name-inferred",
        targetId: reviewedTarget.id,
        targetName: reviewedTarget.name,
        notes,
      });
      continue;
    }

    mappings.push({
      sourceId: sourceVariable.id,
      sourceName: sourceVariable.name,
      currentAliasNames,
      matchMethod: "needs-input",
      targetId: null,
      targetName: null,
      notes,
    });
  }

  return mappings;
}

async function applyMappings(
  client: BridgeClient,
  sourceVariables: VariableRecord[],
  mappings: MappingResult[]
) {
  const sourceById = new Map(sourceVariables.map((variable) => [variable.id, variable]));

  for (const mapping of mappings) {
    if (!mapping.targetId) {
      continue;
    }

    const sourceVariable = sourceById.get(mapping.sourceId);
    if (!sourceVariable) {
      throw new Error(`Missing source variable ${mapping.sourceId}`);
    }

    for (const modeId of Object.keys(sourceVariable.valuesByMode)) {
      await client.command("set_variable_value", {
        variableId: sourceVariable.id,
        modeId,
        valueType: "COLOR",
        variableReferenceId: mapping.targetId,
      });
    }
  }
}

function summarizeMappings(mappings: MappingResult[]) {
  const summary = {
    total: mappings.length,
    exactColor: mappings.filter((mapping) => mapping.matchMethod === "exact-color").length,
    nameInferred: mappings.filter((mapping) => mapping.matchMethod === "name-inferred").length,
    needsInput: mappings.filter((mapping) => mapping.matchMethod === "needs-input").length,
  };

  return {
    summary,
    unresolved: mappings.filter((mapping) => mapping.matchMethod === "needs-input"),
    mappings,
  };
}

const options = parseArgs(Bun.argv.slice(2));
const client = new BridgeClient(options.host, options.channel);

const collections = await client.command<VariableCollection[]>("list_collections");
const variables = await client.command<VariableRecord[]>("list_variables", { resolveValues: true });

const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));
const sourceCollection = collections.find((collection) => collection.name === options.sourceCollection);
const targetCollection = collections.find((collection) => collection.name === options.targetCollection);

if (!sourceCollection || !targetCollection) {
  throw new Error(
    `Unable to find source (${options.sourceCollection}) or target (${options.targetCollection}) collection`
  );
}

if (!variables.some((variable) => variable.variableCollectionId)) {
  throw new Error(
    "The active Figma plugin is not returning variableCollectionId yet. Re-run the TalkToFigma plugin in Figma so it picks up the latest bridge changes, then retry."
  );
}

const sourceVariables = variables.filter(
  (variable) =>
    variable.variableCollectionId === sourceCollection.id &&
    variable.resolvedType === "COLOR"
);
const sourceFloatVariables = variables.filter(
  (variable) =>
    variable.variableCollectionId === sourceCollection.id &&
    variable.resolvedType === "FLOAT"
);
const targetVariables = variables.filter(
  (variable) =>
    variable.variableCollectionId === targetCollection.id &&
    variable.resolvedType === "COLOR"
);

const mappings = buildMapping(sourceVariables, targetVariables, collectionsById);
const dryRun = summarizeMappings(mappings);

if (options.apply) {
  if (dryRun.summary.needsInput > 0) {
    throw new Error(
      `Refusing to apply while ${dryRun.summary.needsInput} mappings still need input`
    );
  }

  await applyMappings(client, sourceVariables, mappings);
}

console.log(
  JSON.stringify(
    {
      channel: options.channel,
      sourceCollection: {
        id: sourceCollection.id,
        name: sourceCollection.name,
        colorVariableCount: sourceVariables.length,
        floatVariableCount: sourceFloatVariables.length,
      },
      targetCollection: {
        id: targetCollection.id,
        name: targetCollection.name,
        colorVariableCount: targetVariables.length,
      },
      nomenclature: {
        pageId: NOMENCLATURE.pageId,
        title: NOMENCLATURE.title,
      },
      applyRequested: options.apply,
      ...dryRun,
    },
    null,
    2
  )
);

export {};
