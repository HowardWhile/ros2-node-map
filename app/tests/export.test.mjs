import assert from "node:assert/strict";
import test from "node:test";

import {
  graphToJson,
  graphToMermaidMarkdown,
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

test("keeps imported data complete while applying filters only to the visible graph", () => {
  globalThis.window = {};
  const store = new GraphSessionStore();
  const completeSnapshot = structuredClone(snapshot);
  completeSnapshot.nodes.push({
    id: "topic:/rosout",
    kind: "ros_topic",
    label: "/rosout",
    types: ["rcl_interfaces/msg/Log"],
  });

  assert.equal(store.importSnapshotText(JSON.stringify(completeSnapshot), "complete.json"), true);
  const state = store.getSnapshot();
  assert.equal(state.snapshot.nodes.length, 3);
  assert.equal(state.visibleSnapshot.nodes.length, 2);
  assert.deepEqual(parseGraphSnapshot(graphToJson(state.snapshot)), completeSnapshot);
  store.dispose();
  delete globalThis.window;
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
