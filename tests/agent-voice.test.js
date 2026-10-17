import test from "node:test";
import assert from "node:assert/strict";
import { VoiceSession } from "../preview/voice.js";
test("session survives layout movement; mute/interruption/end release tracks", async () => {
  let stopped = 0;
  const track = {
    enabled: true,
    stop() {
      stopped++;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        }),
      },
    },
    configurable: true,
  });
  globalThis.AudioContext = class {
    async resume() {}
    createAnalyser() {
      return {
        getByteTimeDomainData(a) {
          a.fill(128);
        },
      };
    }
    createMediaStreamSource() {
      return { connect() {} };
    }
    async close() {}
  };
  const v = new VoiceSession();
  await v.start();
  const stream = v.stream;
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<main id=large></main><aside id=floating></aside>");
  const node = dom.window.document.createElement("section");
  node.session = v;
  dom.window.document.getElementById("large").append(node);
  dom.window.document.getElementById("floating").append(node);
  assert.equal(v.stream, stream);
  assert.equal(v.state, "listening");
  v.mute();
  assert.equal(track.enabled, false);
  v.interrupt();
  assert.equal(v.state, "muted");
  dom.window.document.getElementById("large").append(node);
  assert.equal(node.session, v);
  assert.equal(v.stream, stream);
  v.stop();
  assert.equal(stopped, 1);
  assert.equal(v.stream, null);
});
test("late microphone grant cannot restart an ended session", async () => {
  let grant,
    stopped = 0;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: { getUserMedia: () => new Promise((r) => (grant = r)) },
    },
    configurable: true,
  });
  const v = new VoiceSession(),
    p = v.start();
  v.stop();
  grant({
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  });
  await p;
  assert.equal(v.state, "idle");
  assert.equal(v.stream, null);
  assert.equal(stopped, 1);
});
test("microphone failure falls back to typing state without fabricated transcript", async () => {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          throw Error("denied");
        },
      },
    },
    configurable: true,
  });
  const v = new VoiceSession();
  await v.start();
  assert.equal(v.state, "failed");
  assert.equal(v.speak("اختبار", null), false);
});
