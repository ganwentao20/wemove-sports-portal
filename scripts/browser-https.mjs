import https from "node:https";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";

// Acceptance uses the production Secure/HttpOnly session cookies unchanged.
// The ephemeral certificate is trusted only by the test browser context.
await mkdir(".local", { recursive: true });
const directory = await mkdtemp(path.resolve(".local/browser-tls-"));
const key = path.join(directory, "key.pem");
const cert = path.join(directory, "cert.pem");
const windowsOpenSsl = "C:/Program Files/Git/usr/bin/openssl.exe";
const openssl =
  process.platform === "win32" && existsSync(windowsOpenSsl)
    ? windowsOpenSsl
    : "openssl";
execFileSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    key,
    "-out",
    cert,
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore" },
);
const server = https.createServer(
  { key: await readFile(key), cert: await readFile(cert) },
  (request, response) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        method: request.method,
        path: request.url,
        headers: {
          ...request.headers,
          "x-forwarded-proto": "https",
          "x-forwarded-host": request.headers.host,
        },
      },
      (result) => {
        response.writeHead(result.statusCode || 502, result.headers);
        result.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end("Test upstream unavailable");
    });
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableEnded) upstream.destroy();
    });
    request.pipe(upstream);
  },
);
server.on("upgrade", (request, socket, head) => {
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: 3000,
    method: request.method,
    path: request.url,
    headers: {
      ...request.headers,
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "x-forwarded-proto": "https",
      "x-forwarded-host": request.headers.host,
    },
  });
  upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(response.headers)
      .flatMap(([name, value]) =>
        Array.isArray(value)
          ? value.map((item) => `${name}: ${item}`)
          : value === undefined
            ? []
            : [`${name}: ${value}`],
      )
      .join("\r\n");
    socket.write(
      `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${headers}\r\n\r\n`,
    );
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});
server.listen(3443, "127.0.0.1", () =>
  console.log("HTTPS acceptance proxy ready on https://127.0.0.1:3443"),
);
async function stop() {
  server.closeAllConnections();
  server.close();
  await Promise.all([unlink(key), unlink(cert)]);
  await rmdir(directory);
  process.exit(0);
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
