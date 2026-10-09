function bandPeak(freq, sampleRate, lowHz, highHz) {
  const nyquist = sampleRate / 2;
  const start = Math.max(0, Math.floor((lowHz / nyquist) * freq.length));
  const end = Math.min(freq.length - 1, Math.ceil((highHz / nyquist) * freq.length));
  let peak = 0;
  for (let i = start; i <= end; i += 1) peak = Math.max(peak, freq[i]);
  return peak / 255;
}

function rms(time) {
  let sum = 0;
  for (let i = 0; i < time.length; i += 1) {
    const sample = (time[i] - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / time.length);
}

export function createSound() {
  let ctx = null;
  let analyser = null;
  let source = null;
  let stream = null;
  let fileEl = null;
  let fileUrl = null;
  let extras = [];
  let mode = "off";
  let time = null;
  let freq = null;
  const peaks = { level: 0.02, low: 0.02, mid: 0.02, high: 0.02 };

  function ensure() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;
    time = new Uint8Array(analyser.fftSize);
    freq = new Uint8Array(analyser.frequencyBinCount);
    return ctx;
  }

  function disconnectSource() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    if (fileEl) {
      fileEl.pause();
      fileEl.removeAttribute("src");
      fileEl.load();
      fileEl = null;
    }
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
      fileUrl = null;
    }
    for (const extra of extras) {
      try {
        extra.stop();
      } catch {
        // already stopped
      }
      try {
        extra.disconnect();
      } catch {
        // already disconnected
      }
    }
    extras = [];
    if (source) {
      try {
        source.disconnect();
      } catch {
        // already disconnected
      }
      if (typeof source.stop === "function") {
        try {
          source.stop();
        } catch {
          // oscillator already stopped
        }
      }
      source = null;
    }
  }

  async function attach(node, hear) {
    ensure();
    disconnectSource();
    try {
      analyser.disconnect();
    } catch {
      // nothing was listening
    }
    source = node;
    peaks.level = 0.02;
    peaks.low = 0.02;
    peaks.mid = 0.02;
    peaks.high = 0.02;
    node.connect(analyser);
    if (hear) {
      const master = ctx.createGain();
      master.gain.value = 0.08;
      analyser.connect(master);
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") await ctx.resume();
  }

  return {
    get mode() {
      return mode;
    },
    async startMic() {
      ensure();
      const next = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
      });
      await attach(ctx.createMediaStreamSource(next), false);
      stream = next;
      mode = "mic";
    },
    async startFile(file) {
      ensure();
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      audio.loop = true;
      await audio.play();
      await attach(ctx.createMediaElementSource(audio), true);
      fileEl = audio;
      fileUrl = url;
      mode = "file";
    },
    async startPreview() {
      const context = ensure();
      const mix = context.createGain();
      mix.gain.value = 1;
      const voices = [
        { frequency: 90, rate: 0.4, level: 0.5 },
        { frequency: 480, rate: 0.8, level: 0.16 },
        { frequency: 2200, rate: 1.3, level: 0.035 },
      ].map(({ frequency, rate, level }) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const lfo = context.createOscillator();
        const shaper = context.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < curve.length; i += 1) {
          const opened = Math.max(0, (i / (curve.length - 1) - 0.72) / 0.28);
          curve[i] = opened * opened * level;
        }
        shaper.curve = curve;
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.value = 0;
        lfo.frequency.value = rate;
        lfo.connect(shaper);
        shaper.connect(gain.gain);
        osc.connect(gain);
        gain.connect(mix);
        return { osc, lfo };
      });
      await attach(mix, true);
      extras = voices.flatMap((voice) => [voice.osc, voice.lfo]);
      for (const node of extras) node.start();
      mode = "preview";
    },
    stop() {
      disconnectSource();
      if (analyser) {
        try {
          analyser.disconnect();
        } catch {
          // no downstream
        }
      }
      mode = "off";
    },
    levels() {
      if (!analyser || mode === "off") return null;
      analyser.getByteTimeDomainData(time);
      analyser.getByteFrequencyData(freq);
      const rate = ctx.sampleRate;
      const raw = {
        level: rms(time),
        low: bandPeak(freq, rate, 20, 160),
        mid: bandPeak(freq, rate, 160, 2000),
        high: bandPeak(freq, rate, 2000, 8000),
      };
      const shaped = {};
      for (const key of Object.keys(raw)) {
        peaks[key] = Math.max(0.02, raw[key], peaks[key] * 0.995);
        shaped[key] = raw[key] < 0.008 ? 0 : Math.min(1, raw[key] / peaks[key]);
      }
      return shaped;
    },
  };
}
