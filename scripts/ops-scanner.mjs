import http from "node:http";
import net from "node:net";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

// Clamd INSTREAM framing avoids filenames and never executes uploaded content.
export function clamd(
  command,
  bytes,
  {
    host = process.env.CLAMD_HOST || "clamav",
    port = Number(process.env.CLAMD_PORT || 3310),
    timeout = 12000,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    socket.setTimeout(timeout, () =>
      socket.destroy(new Error("Scanner timeout")),
    );
    socket.once("error", reject);
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.length > 2048)
        socket.destroy(new Error("Invalid scanner response"));
      if (response.includes("\0") || response.includes("\n")) {
        socket.end();
        resolve(response.replace(/[\0\n]+$/, ""));
      }
    });
    socket.once("end", () =>
      response
        ? resolve(response.replace(/[\0\n]+$/, ""))
        : reject(new Error("Empty scanner response")),
    );
    socket.once("connect", () => {
      socket.write(`z${command}\0`);
      if (bytes) {
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const chunk = bytes.subarray(offset, offset + 65536);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length);
          socket.write(size);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      }
    });
  });
}

export function createScannerServer({
  token = process.env.SCANNER_TOKEN,
  maxBytes = 5 * 1024 * 1024,
  scanner = clamd,
} = {}) {
  if (!token || token.length < 32)
    throw new Error("SCANNER_TOKEN must contain at least 32 characters");
  const expected = Buffer.from(`Bearer ${token}`);
  return http.createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && req.url === "/health")
        return reply((await scanner("PING")) === "PONG" ? 200 : 503, {
          service: "scanner",
        });
      if (req.method !== "POST" || req.url !== "/scan")
        return reply(404, { error: "Not found" });
      const actual = Buffer.from(req.headers.authorization || "");
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
      )
        return reply(401, { error: "Unauthorized" });
      if (
        !String(req.headers["content-type"]).startsWith(
          "application/octet-stream",
        )
      )
        return reply(415, { error: "Use application/octet-stream" });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes)
          return reply(413, { error: "Upload exceeds scanner limit" });
        chunks.push(chunk);
      }
      const result = await scanner("INSTREAM", Buffer.concat(chunks));
      if (result === "stream: OK") return reply(200, { clean: true });
      if (result.startsWith("stream: ") && result.endsWith(" FOUND"))
        return reply(200, { clean: false });
      return reply(503, { error: "Scanner could not determine file safety" });
    } catch {
      reply(503, { error: "Scanner unavailable" });
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createScannerServer();
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.SCANNER_PORT || 8081), "0.0.0.0");
  process.on("SIGTERM", () => server.close());
}
