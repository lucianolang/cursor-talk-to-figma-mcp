import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";

type RelayClient = WebSocket & { joinedChannel?: string };

export type RelayServer = {
  port: number;
  host: string;
  close: () => Promise<void>;
};

function sendJson(client: WebSocket, payload: unknown) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
}

export function startRelayServer(port = 3055, host = "127.0.0.1"): RelayServer {
  const channels = new Map<string, Set<RelayClient>>();

  const httpServer = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    });
    res.end("WebSocket server running");
  });

  const wss = new WebSocketServer({ server: httpServer });

  function handleServerError(error: Error & { code?: string }) {
    console.error(`Relay server error: ${error.message}`);
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Choose another port with --port.`);
    }
    process.exit(1);
  }

  httpServer.on("error", handleServerError);
  wss.on("error", handleServerError);

  function removeClient(client: RelayClient) {
    for (const [channelName, clients] of channels.entries()) {
      if (!clients.delete(client)) continue;

      for (const peer of clients) {
        sendJson(peer, {
          type: "system",
          message: "A user has left the channel",
          channel: channelName,
        });
      }

      if (clients.size === 0) {
        channels.delete(channelName);
      }
    }
  }

  wss.on("connection", (client: RelayClient) => {
    console.log("New client connected");
    sendJson(client, {
      type: "system",
      message: "Please join a channel to start chatting",
    });

    client.on("message", (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());

        if (data.type === "join") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            sendJson(client, { type: "error", message: "Channel name is required" });
            return;
          }

          removeClient(client);

          if (!channels.has(channelName)) {
            channels.set(channelName, new Set());
          }

          const clients = channels.get(channelName)!;
          clients.add(client);
          client.joinedChannel = channelName;

          console.log(`Client joined channel "${channelName}" (${clients.size} total clients)`);

          sendJson(client, {
            type: "system",
            message: `Joined channel: ${channelName}`,
            channel: channelName,
          });

          sendJson(client, {
            type: "system",
            message: {
              id: data.id,
              result: `Connected to channel: ${channelName}`,
            },
            channel: channelName,
          });

          for (const peer of clients) {
            if (peer !== client) {
              sendJson(peer, {
                type: "system",
                message: "A new user has joined the channel",
                channel: channelName,
              });
            }
          }
          return;
        }

        if (data.type === "message" || data.type === "progress_update") {
          const channelName = data.channel;
          if (!channelName || typeof channelName !== "string") {
            sendJson(client, { type: "error", message: "Channel name is required" });
            return;
          }

          const clients = channels.get(channelName);
          if (!clients || !clients.has(client)) {
            sendJson(client, { type: "error", message: "You must join the channel first" });
            return;
          }

          let broadcastCount = 0;
          for (const peer of clients) {
            if (peer === client) continue;
            broadcastCount++;
            sendJson(
              peer,
              data.type === "progress_update"
                ? data
                : {
                    type: "broadcast",
                    message: data.message,
                    sender: "peer",
                    channel: channelName,
                  }
            );
          }

          if (broadcastCount === 0) {
            console.log(`No other clients in channel "${channelName}" to receive message`);
          }
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    client.on("close", () => {
      console.log("Client disconnected");
      removeClient(client);
    });
  });

  httpServer.listen(port, host, () => {
    console.log(`WebSocket server running on ${host}:${port}`);
  });

  return {
    port,
    host,
    close: () =>
      new Promise((resolve, reject) => {
        wss.close((webSocketError) => {
          if (webSocketError) {
            reject(webSocketError);
            return;
          }
          httpServer.close((httpError) => {
            if (httpError) reject(httpError);
            else resolve();
          });
        });
      }),
  };
}
