// The session owns audio; moving the UI never recreates this object.
export class VoiceSession {
  constructor({ onState = () => {}, onLevel = () => {} } = {}) {
    this.onState = onState;
    this.onLevel = onLevel;
    this.state = "idle";
    this.generation = 0;
    this.muted = false;
  }
  set(state) {
    this.state = state;
    this.onState(state);
  }
  async start() {
    if (this.stream) return;
    const generation = ++this.generation;
    this.set("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.context = new AC();
      await this.context.resume();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      this.context.createMediaStreamSource(stream).connect(this.analyser);
      this.set("listening");
      const bytes = new Uint8Array(128);
      this.timer = setInterval(() => {
        this.analyser.getByteTimeDomainData(bytes);
        this.onLevel(
          this.muted
            ? 0
            : Math.max(...bytes.map((x) => Math.abs(x - 128))) / 128,
        );
      }, 60);
      stream.getAudioTracks()[0].onended = () => this.stop();
    } catch {
      this.stop();
      this.set("failed");
    }
  }
  mute() {
    this.muted = !this.muted;
    this.stream?.getTracks().forEach((t) => (t.enabled = !this.muted));
    this.set(this.muted ? "muted" : this.stream ? "listening" : "idle");
  }
  interrupt() {
    globalThis.speechSynthesis?.cancel();
    this.set(this.stream ? (this.muted ? "muted" : "listening") : "idle");
  }
  speak(text, voice) {
    this.interrupt();
    if (!globalThis.speechSynthesis || !voice) {
      this.set("failed");
      return false;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9;
    utterance.onstart = () => this.set("speaking");
    utterance.onend = () => this.interrupt();
    utterance.onerror = () => this.set("failed");
    speechSynthesis.speak(utterance);
    return true;
  }
  stop() {
    ++this.generation;
    this.interrupt();
    clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    this.context?.close().catch(() => {});
    this.context = null;
    this.set("idle");
  }
}
