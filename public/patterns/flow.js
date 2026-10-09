import {
  P,
  circle,
  fill,
  ival,
  line,
  noise2,
  pattern,
  rng,
  sheet,
  stroke,
  val,
} from "../lib/geom.js";

function trace(x, y, steps, dt, field, bounds) {
  const pts = [{ x, y }];
  let px = x;
  let py = y;
  for (let i = 0; i < steps; i += 1) {
    const v = field(px, py);
    const len = Math.hypot(v.x, v.y) || 1;
    px += (v.x / len) * dt;
    py += (v.y / len) * dt;
    if (px < bounds.x0 || px > bounds.x1 || py < bounds.y0 || py > bounds.y1) break;
    pts.push({ x: px, y: py });
  }
  return pts;
}

export const flowPatterns = [
  pattern({
    id: "flow-dots",
    name: "Flow dots",
    tags: ["flow", "grid"],
    note: "Dots leave the top in a straight comb. Lower down a field turns them into strands.",
    params: [
      P("columns", "Columns", 6, 36, 1, 18),
      P("rows", "Rows", 8, 40, 1, 22),
      P("turn", "Turn", 0, 1, 0.01, 0.55),
      P("seed", "Seed", 0, 999, 1, 3),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const turn = val(v, "turn");
      const seed = ival(v, "seed");
      const marks = [];
      for (let c = 0; c < cols; c += 1) {
        let x = 120 + (c / Math.max(1, cols - 1)) * 760;
        let y = 80;
        for (let r = 0; r < rows; r += 1) {
          marks.push(fill(circle(x, y, 3.2), 0.9));
          const fall = r / rows;
          const ang = noise2(x * 0.004, y * 0.004, seed) * Math.PI * 2;
          x += Math.cos(ang) * turn * 18 * fall;
          y += 840 / rows;
          x = Math.max(40, Math.min(960, x));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "flow-lines",
    name: "Flow lines",
    tags: ["flow", "physics"],
    note: "Streamlines follow a field. Each finished line offers the next seed a set distance to the side, so the gaps stay even.",
    params: [
      P("gap", "Gap", 16, 80, 1, 36),
      P("turn", "Turn", 0, 1, 0.01, 0.6),
      P("seed", "Seed", 0, 999, 1, 5),
    ],
    render(v) {
      const gap = val(v, "gap");
      const turn = val(v, "turn");
      const seed = ival(v, "seed");
      const bounds = { x0: 70, y0: 70, x1: 930, y1: 930 };
      const field = (x, y) => {
        const a = noise2(x * 0.003, y * 0.003, seed) * Math.PI * 2;
        return { x: Math.cos(a) * turn + 0.15, y: Math.sin(a) * turn + 0.35 };
      };
      const samples = [];
      const near = (x, y) => samples.some((p) => Math.hypot(p.x - x, p.y - y) < gap * 0.85);
      const queue = [{ x: 120, y: 140 }];
      const marks = [];
      let guard = 0;
      while (queue.length && marks.length < 48 && guard < 400) {
        guard += 1;
        const seedPt = queue.shift();
        if (near(seedPt.x, seedPt.y)) continue;
        const fwd = trace(seedPt.x, seedPt.y, 80, gap * 0.45, field, bounds);
        const back = trace(seedPt.x, seedPt.y, 40, gap * 0.45, (x, y) => {
          const f = field(x, y);
          return { x: -f.x, y: -f.y };
        }, bounds);
        const pts = [...back.reverse(), ...fwd.slice(1)];
        if (pts.length < 4) continue;
        marks.push(stroke(line(pts)));
        for (let i = 0; i < pts.length; i += 3) {
          samples.push(pts[i]);
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          queue.push({ x: pts[i].x + nx * gap, y: pts[i].y + ny * gap });
          queue.push({ x: pts[i].x - nx * gap, y: pts[i].y - ny * gap });
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "flow-poles",
    name: "Flow poles",
    tags: ["flow", "radial"],
    note: "A ring of poles takes turns as a vortex and a sink. Streamlines bend around them.",
    params: [
      P("poles", "Poles", 2, 10, 1, 6),
      P("strength", "Strength", 0.2, 2, 0.01, 1),
      P("lines", "Lines", 6, 30, 1, 16),
      P("seed", "Seed", 0, 999, 1, 2),
    ],
    render(v) {
      const count = ival(v, "poles");
      const strength = val(v, "strength");
      const lines = ival(v, "lines");
      const rand = rng(ival(v, "seed"));
      const poles = [];
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        poles.push({
          x: 500 + Math.cos(a) * 220,
          y: 500 + Math.sin(a) * 220,
          vortex: i % 2 === 0,
        });
      }
      const field = (x, y) => {
        let vx = 0;
        let vy = 0;
        for (const p of poles) {
          const dx = x - p.x;
          const dy = y - p.y;
          const r2 = dx * dx + dy * dy + 80;
          if (p.vortex) {
            vx += (-dy / r2) * strength * 800;
            vy += (dx / r2) * strength * 800;
          } else {
            vx += (-dx / r2) * strength * 800;
            vy += (-dy / r2) * strength * 800;
          }
        }
        return { x: vx, y: vy };
      };
      const bounds = { x0: 40, y0: 40, x1: 960, y1: 960 };
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const pts = trace(80 + rand() * 840, 80 + rand() * 840, 70, 12, field, bounds);
        if (pts.length > 3) marks.push(stroke(line(pts)));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "wave-field",
    name: "Wave field",
    tags: ["flow", "noise", "organic"],
    note: "Short strokes take their angle from smooth noise, so streams and eddies show up.",
    params: [
      P("columns", "Columns", 8, 36, 1, 20),
      P("rows", "Rows", 8, 36, 1, 20),
      P("scale", "Scale", 0.05, 0.8, 0.01, 0.18),
      P("length", "Length", 4, 28, 0.1, 14),
      P("seed", "Seed", 0, 999, 1, 1),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const scale = val(v, "scale");
      const len = val(v, "length");
      const seed = ival(v, "seed");
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const px = 90 + (x / Math.max(1, cols - 1)) * 820;
          const py = 90 + (y / Math.max(1, rows - 1)) * 820;
          const a = noise2(x * scale, y * scale, seed) * Math.PI * 2;
          marks.push(stroke(line([
            { x: px - Math.cos(a) * len, y: py - Math.sin(a) * len },
            { x: px + Math.cos(a) * len, y: py + Math.sin(a) * len },
          ])));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "node-garden",
    name: "Node garden",
    tags: ["noise", "organic"],
    note: "Scattered points join their neighbors. Noise nudges the points so the links keep changing.",
    params: [
      P("count", "Count", 12, 80, 1, 36),
      P("reach", "Reach", 40, 220, 1, 120),
      P("drift", "Drift", 0, 1, 0.01, 0.35),
      P("seed", "Seed", 0, 999, 1, 4),
    ],
    render(v) {
      const count = ival(v, "count");
      const reach = val(v, "reach");
      const drift = val(v, "drift");
      const rand = rng(ival(v, "seed") + 1);
      const seed = ival(v, "seed");
      const nodes = [];
      for (let i = 0; i < count; i += 1) {
        const x = 100 + rand() * 800;
        const y = 100 + rand() * 800;
        nodes.push({
          x: x + (noise2(i * 0.2, 0.2, seed) - 0.5) * 80 * drift,
          y: y + (noise2(0.2, i * 0.2, seed + 3) - 0.5) * 80 * drift,
        });
      }
      const marks = [];
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < reach) {
            marks.push(stroke(line([nodes[i], nodes[j]]), 0.9));
          }
        }
        marks.push(fill(circle(nodes[i].x, nodes[i].y, 3.5), 0.95));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "interference-mesh",
    name: "Interference mesh",
    tags: ["physics", "grid"],
    note: "Two points send out circular waves. Where they add, the lines spread. Where they cancel, the lines bunch.",
    params: [
      P("lines", "Lines", 12, 60, 1, 32),
      P("frequency", "Frequency", 0.2, 4, 0.01, 1.1),
      P("amplitude", "Amplitude", 0, 40, 0.1, 16),
      P("separation", "Separation", 40, 400, 1, 180),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const freq = val(v, "frequency");
      const amp = val(v, "amplitude");
      const sep = val(v, "separation");
      const s1 = { x: 500 - sep / 2, y: 420 };
      const s2 = { x: 500 + sep / 2, y: 620 };
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const base = 80 + (i / Math.max(1, lines - 1)) * 840;
        const pts = [];
        for (let s = 0; s <= 48; s += 1) {
          const x = 70 + (s / 48) * 860;
          const d1 = Math.hypot(x - s1.x, base - s1.y);
          const d2 = Math.hypot(x - s2.x, base - s2.y);
          const y = base + (Math.sin(d1 * freq * 0.05) + Math.sin(d2 * freq * 0.05)) * amp;
          pts.push({ x, y });
        }
        marks.push(stroke(line(pts)));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "resonance-field",
    name: "Resonance field",
    tags: ["flow", "distortion", "physics"],
    note: "Several waves shove the same grid at once. The overlaps pile up into a resonance.",
    params: [
      P("columns", "Columns", 8, 32, 1, 18),
      P("rows", "Rows", 8, 32, 1, 18),
      P("amplitude", "Amplitude", 0, 30, 0.1, 12),
      P("sources", "Sources", 1, 5, 1, 3),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const amp = val(v, "amplitude");
      const sources = ival(v, "sources");
      const marks = [];
      const centers = [];
      for (let i = 0; i < sources; i += 1) {
        const a = (i / sources) * Math.PI * 2;
        centers.push({ x: 500 + Math.cos(a) * 180, y: 500 + Math.sin(a) * 180 });
      }
      const pts = [];
      for (let y = 0; y <= rows; y += 1) {
        const row = [];
        for (let x = 0; x <= cols; x += 1) {
          const px = 90 + (x / cols) * 820;
          const py = 90 + (y / rows) * 820;
          let dy = 0;
          for (const c of centers) dy += Math.sin(Math.hypot(px - c.x, py - c.y) * 0.03) * amp;
          row.push({ x: px, y: py + dy / sources });
        }
        pts.push(row);
      }
      for (const row of pts) marks.push(stroke(line(row)));
      for (let x = 0; x <= cols; x += 1) marks.push(stroke(line(pts.map((row) => row[x]))));
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "wavy-lines-converging",
    name: "Wavy lines converging",
    tags: ["flow", "organic"],
    note: "Sine waves stacked on the page, each a little quicker than the last, so they cross and part.",
    params: [
      P("lines", "Lines", 3, 12, 1, 5),
      P("amplitude", "Amplitude", 0, 80, 0.1, 36),
      P("frequency", "Frequency", 0.4, 6, 0.1, 1.6),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const amp = val(v, "amplitude");
      const freq = val(v, "frequency");
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const y0 = 180 + (i / Math.max(1, lines - 1)) * 640;
        const f = freq * (1 + i * 0.45);
        const pts = [];
        for (let s = 0; s <= 64; s += 1) {
          const x = 70 + (s / 64) * 860;
          const u = s / 64;
          pts.push({ x, y: y0 + Math.sin(u * Math.PI * 2 * f + i) * amp * (0.45 + i / lines) });
        }
        marks.push(stroke(line(pts), 1.3));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "signal-decay",
    name: "Signal decay",
    tags: ["flow"],
    note: "A wave whose swings get shorter and smaller, the way a signal fades.",
    params: [
      P("lines", "Lines", 1, 8, 1, 4),
      P("amplitude", "Amplitude", 10, 120, 1, 70),
      P("decay", "Decay", 0.2, 3, 0.01, 1.1),
      P("cycles", "Cycles", 1, 12, 0.1, 5),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const amp = val(v, "amplitude");
      const decay = val(v, "decay");
      const cycles = val(v, "cycles");
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const y0 = 160 + (i / Math.max(1, lines - 1)) * 680;
        const pts = [];
        for (let s = 0; s <= 80; s += 1) {
          const u = s / 80;
          const env = Math.exp(-u * decay);
          const phase = u * cycles * Math.PI * 2 * (1 + u);
          pts.push({ x: 80 + u * 840, y: y0 + Math.sin(phase + i) * amp * env });
        }
        marks.push(stroke(line(pts), 1.3));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "noise-landscape-1",
    name: "Noise landscape",
    tags: ["noise", "flow"],
    note: "Horizontal lines rise and fall with noise, like contours on a map.",
    params: [
      P("lines", "Lines", 10, 50, 1, 28),
      P("amplitude", "Amplitude", 0, 50, 0.1, 22),
      P("scale", "Scale", 0.05, 0.8, 0.01, 0.2),
      P("seed", "Seed", 0, 999, 1, 6),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const amp = val(v, "amplitude");
      const scale = val(v, "scale");
      const seed = ival(v, "seed");
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const y = 70 + (i / Math.max(1, lines - 1)) * 860;
        const pts = [];
        for (let s = 0; s <= 40; s += 1) {
          const x = 70 + (s / 40) * 860;
          const n = noise2(s * scale, i * scale * 0.8, seed);
          pts.push({ x, y: y + (n - 0.5) * amp * 2 });
        }
        marks.push(stroke(line(pts)));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "joy-division",
    name: "Joy division",
    tags: ["noise", "flow"],
    study: true,
    note: "Study only. Do not publish. Stacked lines, taller in the middle, from the idea of the Unknown Pleasures cover.",
    params: [
      P("lines", "Lines", 12, 50, 1, 32),
      P("amplitude", "Amplitude", 0, 80, 0.1, 40),
      P("scale", "Scale", 0.05, 0.6, 0.01, 0.18),
      P("seed", "Seed", 0, 999, 1, 1),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const amp = val(v, "amplitude");
      const scale = val(v, "scale");
      const seed = ival(v, "seed");
      const marks = [];
      for (let i = 0; i < lines; i += 1) {
        const y = 80 + (i / Math.max(1, lines - 1)) * 840;
        const pts = [];
        for (let s = 0; s <= 48; s += 1) {
          const u = s / 48;
          const x = 80 + u * 840;
          const bell = Math.exp(-((u - 0.5) ** 2) / 0.05);
          const n = noise2(s * scale, i * 0.15, seed);
          pts.push({ x, y: y - Math.abs(n - 0.2) * amp * bell });
        }
        marks.push(stroke(line(pts)));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "joy-division-mesh",
    name: "Joy division mesh",
    tags: ["noise", "grid"],
    study: true,
    note: "Study only. Do not publish. A wire mesh of that same middle-weighted terrain.",
    params: [
      P("columns", "Columns", 8, 36, 1, 20),
      P("rows", "Rows", 8, 30, 1, 16),
      P("amplitude", "Amplitude", 0, 80, 0.1, 36),
      P("seed", "Seed", 0, 999, 1, 2),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const amp = val(v, "amplitude");
      const seed = ival(v, "seed");
      const pts = [];
      for (let y = 0; y <= rows; y += 1) {
        const row = [];
        const vy = y / rows;
        for (let x = 0; x <= cols; x += 1) {
          const u = x / cols;
          const bell = Math.exp(-((u - 0.5) ** 2) / 0.06) * Math.exp(-((vy - 0.5) ** 2) / 0.08);
          const n = noise2(x * 0.22, y * 0.22, seed);
          row.push({
            x: 90 + u * 820,
            y: 90 + vy * 820 - n * amp * bell,
          });
        }
        pts.push(row);
      }
      const marks = [];
      for (const row of pts) marks.push(stroke(line(row)));
      for (let x = 0; x <= cols; x += 1) marks.push(stroke(line(pts.map((row) => row[x]))));
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "lissajous-field",
    name: "Lissajous field",
    tags: ["flow", "physics"],
    note: "Each cell traces the curve of two sine waves, one across and one down.",
    params: [
      P("columns", "Columns", 2, 8, 1, 4),
      P("rows", "Rows", 2, 8, 1, 4),
      P("a", "Across", 1, 7, 1, 3),
      P("b", "Down", 1, 7, 1, 2),
      P("delta", "Phase", 0, 3.1, 0.01, 0.6),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const a = ival(v, "a");
      const b = ival(v, "b");
      const delta = val(v, "delta");
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const cx = ox + (x + 0.5) * cell;
          const cy = oy + (y + 0.5) * cell;
          const r = cell * 0.36;
          const aa = a + (x % 3);
          const bb = b + (y % 3);
          const pts = [];
          for (let s = 0; s <= 80; s += 1) {
            const t = (s / 80) * Math.PI * 2;
            pts.push({
              x: cx + Math.sin(aa * t + delta) * r,
              y: cy + Math.sin(bb * t) * r,
            });
          }
          marks.push(stroke(line(pts)));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
];
