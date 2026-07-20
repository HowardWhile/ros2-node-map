import assert from "node:assert/strict";
import test from "node:test";

import {
  createVaultZip,
  graphToJson,
  graphToMermaidMarkdown,
  graphToObsidianVault,
} from "../src/graph/exporters.ts";
import { parseGraphSnapshot } from "../src/graph/snapshot.ts";
import { GraphSessionStore } from "../src/graph/GraphSessionStore.ts";

const snapshot = {
  schema_version: "0.1.0",
  timestamp: "2026-07-20T12:00:00+08:00",
  ros_domain_id: "49",
  nodes: [
    { id: "node:/talker", kind: "ros_node", label: "/talker", name: "talker", namespace: "/" },
    { id: "topic:/chatter", kind: "ros_topic", label: "/chatter", types: ["std_msgs/msg/String"] },
  ],
  edges: [
    {
      id: "publish:node:/talker->topic:/chatter",
      kind: "publish",
      source: "node:/talker",
      target: "topic:/chatter",
    },
  ],
};

test("parses a complete graph snapshot and rejects invalid endpoints", () => {
  assert.deepEqual(parseGraphSnapshot(JSON.stringify(snapshot)), snapshot);
  const invalid = structuredClone(snapshot);
  invalid.edges[0].target = "topic:/missing";
  assert.throws(
    () => parseGraphSnapshot(JSON.stringify(invalid)),
    /references a node that is not present/,
  );
});

test("rejects unsupported fields instead of guessing their meaning", () => {
  assert.throws(
    () => parseGraphSnapshot(JSON.stringify({ ...snapshot, future_field: true })),
    /unsupported field/,
  );
});

test("exports round-trippable JSON and directed Mermaid Markdown", () => {
  assert.deepEqual(parseGraphSnapshot(graphToJson(snapshot)), snapshot);
  const markdown = graphToMermaidMarkdown(snapshot);
  assert.match(markdown, /```mermaid\nflowchart LR/);
  assert.match(markdown, /n0 -->\|publish\| n1/);
  assert.match(markdown, /ROS_DOMAIN_ID: 49/);
});

test("builds an Obsidian vault with linked entity pages and a ZIP archive", () => {
  const files = graphToObsidianVault(snapshot);
  assert.equal(files.length, 3);
  assert.equal(files[0].path, "ROS 2 Graph.md");
  assert.match(files[0].content, /\[\[Entities\/node-talker\|\/talker\]\]/);
  assert.match(files.find((file) => file.path.includes("node-talker")).content, /publish/);

  const zip = createVaultZip(files, new Date(2026, 0, 1));
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(zip.buffer).getUint32(zip.length - 22, true), 0x06054b50);
});

test("keeps the current graph when a file fails validation", () => {
  globalThis.window = {
    ros2NodeMap: {
      getRuntimeStatus: async () => ({
        rosAvailable: false,
        backendAvailable: false,
        liveAvailable: false,
        reason: "test runtime",
      }),
    },
  };
  const store = new GraphSessionStore();
  assert.equal(store.importSnapshotText(JSON.stringify(snapshot), "valid.json"), true);
  const current = store.getSnapshot().snapshot;
  assert.equal(store.importSnapshotText("{not json", "invalid.json"), false);
  assert.strictEqual(store.getSnapshot().snapshot, current);
  assert.match(store.getSnapshot().fileError, /Invalid graph JSON/);
  store.dispose();
  delete globalThis.window;
});
