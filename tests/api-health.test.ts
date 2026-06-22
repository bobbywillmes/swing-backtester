import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { createApiApp } from "../src/api/app.js";

test("GET /api/health returns ok", async () => {
  const server = createServer(createApiApp());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/health`
    );
    const body = (await response.json()) as { ok: boolean };

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
});
