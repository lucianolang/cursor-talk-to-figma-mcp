#!/usr/bin/env node

import { startRelayServer } from "./figma_cli/relay";

startRelayServer(Number(process.env.PORT) || 3055, process.env.HOST || "127.0.0.1");
