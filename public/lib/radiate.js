const ORIGINS = {
  center: { x: 500, y: 500 },
  left: { x: 80, y: 500 },
  right: { x: 920, y: 500 },
  top: { x: 500, y: 80 },
  bottom: { x: 500, y: 920 },
};

function reach(origin) {
  let far = 1;
  for (const x of [80, 920]) {
    for (const y of [80, 920]) far = Math.max(far, Math.hypot(x - origin.x, y - origin.y));
  }
  return far;
}

export function createRadiate() {
  const history = [];
  const state = {
    on: false,
    origin: "center",
    spread: 1.2,
    width: 0.35,
    band: "level",
  };

  function read(time) {
    if (!history.length) return 0;
    if (time <= history[0].t) return 0;
    const last = history[history.length - 1];
    if (time >= last.t) return last.v;
    for (let i = history.length - 1; i > 0; i -= 1) {
      const newer = history[i];
      const older = history[i - 1];
      if (older.t <= time) {
        const span = newer.t - older.t || 1;
        return older.v + ((newer.v - older.v) * (time - older.t)) / span;
      }
    }
    return 0;
  }

  return {
    state,
    push(level, now) {
      history.push({ t: now, v: level });
      const keep = now - 4000;
      while (history.length > 2 && history[0].t < keep) history.shift();
    },
    clear() {
      history.length = 0;
    },
    sample(x, y, now) {
      const origin = ORIGINS[state.origin] || ORIGINS.center;
      const dist = Math.min(1, Math.hypot(x - origin.x, y - origin.y) / reach(origin));
      const delay = dist * state.spread * 1000;
      const span = Math.max(30, state.width * state.spread * 1000);
      const steps = 5;
      let sum = 0;
      for (let i = 0; i < steps; i += 1) {
        const u = i / (steps - 1) - 0.5;
        sum += read(now - delay + u * span);
      }
      return sum / steps;
    },
  };
}
