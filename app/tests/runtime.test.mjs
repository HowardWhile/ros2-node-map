import assert from "node:assert/strict";
import test from "node:test";

import { runtimeStatusFor } from "../electron/runtime.ts";
import { GraphSessionStore } from "../src/graph/GraphSessionStore.ts";

test("Windows always starts in file-only mode", () => {
  assert.deepEqual(runtimeStatusFor({
    platform: "win32",
    rosAvailable: true,
    backendAvailable: true,
    rosSetupPath: "C:\\opt\\ros\\jazzy\\setup.bash",
  }), {
    rosAvailable: false,
    backendAvailable: false,
    liveAvailable: false,
    reason: "ROS 2 live mode is unavailable on win32. File-only mode is active.",
  });
});

test("Linux without ROS starts in file-only mode", () => {
  const status = runtimeStatusFor({
    platform: "linux",
    rosAvailable: false,
    backendAvailable: true,
    rosSetupPath: "/opt/ros/jazzy/setup.bash",
  });
  assert.equal(status.liveAvailable, false);
  assert.match(status.reason, /ROS 2 was not found/);
  assert.match(status.reason, /File-only mode is active/);
});

test("Linux enables live mode only when ROS and the backend are available", () => {
  assert.deepEqual(runtimeStatusFor({
    platform: "linux",
    rosAvailable: true,
    backendAvailable: true,
    rosSetupPath: "/opt/ros/jazzy/setup.bash",
  }), {
    rosAvailable: true,
    backendAvailable: true,
    liveAvailable: true,
    reason: undefined,
  });
});

test("the renderer disconnects live mode when the runtime reports file-only capability", async () => {
  globalThis.window = {
    ros2NodeMap: {
      getRuntimeStatus: async () => ({
        rosAvailable: false,
        backendAvailable: false,
        liveAvailable: false,
        reason: "ROS 2 live mode is unavailable on win32. File-only mode is active.",
      }),
    },
  };

  const store = new GraphSessionStore();
  await new Promise((resolve) => setImmediate(resolve));
  const state = store.getSnapshot();
  assert.equal(state.runtimeReady, true);
  assert.equal(state.liveAvailable, false);
  assert.equal(state.sourceMode, "file");
  assert.equal(state.connectionStatus, "disconnected");
  assert.match(state.statusMessage, /File-only mode is active/);

  store.dispose();
  delete globalThis.window;
});
