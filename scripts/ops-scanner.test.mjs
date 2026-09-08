import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { createScannerServer, clamd } from "./ops-scanner.mjs";
const token = "a".repeat(40);
test("scanner authenticates requests and refuses malware or uncertain scan outcomes", async () => {
  let result = "stream: OK";
  let scanned;
  const server = createScannerServer({
    token,
    maxBytes: 32,
    scanner: async (command, bytes) => {
      scanned = bytes;
      return command === "PING" ? "PONG" : result;
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const scan = (body = "image", authorization = `Bearer ${token}`) =>
    fetch(`${url}/scan`, {
      method: "POST",
      headers: { authorization, "content-type": "application/octet-stream" },
      body,
    });
  try {
    assert.equal((await fetch(`${url}/health`)).status, 200);
    assert.equal((await scan("x", "Bearer wrong")).status, 401);
    assert.deepEqual(await (await scan()).json(), { clean: true });
    assert.equal(scanned.toString(), "image");
    result = "stream: Eicar-Test-Signature FOUND";
    assert.deepEqual(await (await scan()).json(), { clean: false });
    result = "stream: size exceeded ERROR";
    assert.equal((await scan()).status, 503);
    assert.equal((await scan("x".repeat(33))).status, 413);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("clamd adapter transmits binary framed INSTREAM with terminating zero chunk", async () => {
  const payload = Buffer.from([0, 255, 1, 0, 13]);
  let incoming = Buffer.alloc(0);
  const server = net.createServer((socket) =>
    socket.on("data", (bytes) => {
      incoming = Buffer.concat([incoming, bytes]);
      if (incoming.length === 10 + 4 + payload.length + 4)
        socket.end("stream: OK\0");
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    assert.equal(
      await clamd("INSTREAM", payload, {
        host: "127.0.0.1",
        port: server.address().port,
      }),
      "stream: OK",
    );
    assert.equal(incoming.subarray(0, 10).toString(), "zINSTREAM\0");
    assert.equal(incoming.readUInt32BE(10), payload.length);
    assert.deepEqual(incoming.subarray(14, 19), payload);
    assert.equal(incoming.readUInt32BE(19), 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
