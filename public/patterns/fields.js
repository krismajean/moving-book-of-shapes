import {
  P,
  arc,
  bilinear,
  circle,
  cubesToMarks,
  fill,
  frame,
  driven,
  ival,
  lerpPt,
  layout,
  line,
  meshLines,
  noise2,
  pattern,
  pointGrid,
  poly,
  projectIso,
  rng,
  roundRect,
  sheet,
  stroke,
  val,
} from "../lib/geom.js";

function letterHits(text, weight) {
  const word = String(text || "").trim().slice(0, 16);
  const width = 220;
  const height = 280;
  if (!word || typeof document === "undefined") return () => false;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = height * 0.78;
  ctx.font = `700 ${size}px sans-serif`;
  while (size > 18 && ctx.measureText(word).width > width * 0.92) {
    size *= 0.9;
    ctx.font = `700 ${size}px sans-serif`;
  }
  ctx.lineWidth = Math.max(1, weight * 90);
  ctx.strokeText(word, width / 2, height / 2);
  ctx.fillText(word, width / 2, height / 2);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  return (x, y) => {
    const ix = Math.max(0, Math.min(width - 1, Math.round(((x - 140) / 720) * (width - 1))));
    const iy = Math.max(0, Math.min(height - 1, Math.round(((y - 100) / 800) * (height - 1))));
    return pixels[(iy * width + ix) * 4 + 3] > 40;
  };
}

let letterMask = { key: "", hits: () => false };

function maskFor(text, weight) {
  const key = `${text}|${weight}`;
  if (letterMask.key !== key) letterMask = { key, hits: letterHits(text, weight) };
  return letterMask.hits;
}

function deformed(id, name, note, defaults) {
  return pattern({
    id,
    name,
    tags: ["grid", "noise", "distortion"],
    note,
    radiate: "amount",
    params: [
      P("columns", "Columns", 4, 36, 1, defaults.columns),
      P("rows", "Rows", 4, 36, 1, defaults.rows),
      P("amount", "Amount", 0, 1.5, 0.01, defaults.amount),
      P("scale", "Scale", 0.05, 1, 0.01, defaults.scale),
      P("seed", "Seed", 0, 999, 1, defaults.seed),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const box = layout(cols, rows);
      const amount = val(v, "amount");
      const scale = val(v, "scale");
      const seed = ival(v, "seed");
      const pts = pointGrid(cols, rows, (x, y) => {
        const px = box.ox + x * box.cell;
        const py = box.oy + y * box.cell;
        const push = driven(v, amount, 1.5, px, py);
        return {
          x: px + (noise2(x * scale, y * scale, seed + 3) - 0.5) * push * box.cell,
          y: py + (noise2(x * scale + 20, y * scale, seed + 9) - 0.5) * push * box.cell,
        };
      });
      return { viewBox: sheet(), marks: meshLines(pts) };
    },
  });
}

function jittered(cols, rows, amount, seed, margin = 80) {
  const rand = rng(seed + 1);
  const cell = (1000 - margin * 2) / Math.max(cols, rows);
  const ox = (1000 - cell * cols) / 2;
  const oy = (1000 - cell * rows) / 2;
  const amp = (amount / 10) * cell * 0.55;
  const pts = [];
  for (let y = 0; y <= rows; y += 1) {
    const row = [];
    for (let x = 0; x <= cols; x += 1) {
      row.push({
        x: ox + x * cell + (rand() * 2 - 1) * amp,
        y: oy + y * cell + (rand() * 2 - 1) * amp,
      });
    }
    pts.push(row);
  }
  return pts;
}

function quad(a, b, c, d) {
  return poly([a, b, c, d]);
}

export const fieldPatterns = [
  pattern({
    id: "ribbon-grid",
    name: "Ribbon grid",
    tags: ["grid", "distortion"],
    note: "Each cell of a warped grid is striped along a diagonal. The stripes continue into the next cell.",
    params: [
      P("columns", "Columns", 2, 24, 1, 10),
      P("rows", "Rows", 2, 24, 1, 10),
      P("displacement", "Displacement", 0, 20, 0.1, 4),
      P("bands", "Bands", 2, 8, 1, 4),
      P("seed", "Seed", 0, 999, 1, 3),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const bands = Math.max(2, ival(v, "bands"));
      const pts = jittered(cols, rows, val(v, "displacement"), ival(v, "seed"));
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const p00 = pts[y][x];
          const p10 = pts[y][x + 1];
          const p01 = pts[y + 1][x];
          const p11 = pts[y + 1][x + 1];
          const other = (x + y) % 2 === 1;
          const edge = (s) => {
            if (!other) {
              if (s >= 0) return [bilinear(p00, p10, p01, p11, s, 0), bilinear(p00, p10, p01, p11, 1, 1 - s)];
              return [bilinear(p00, p10, p01, p11, 0, -s), bilinear(p00, p10, p01, p11, 1 + s, 1)];
            }
            const t = (s + 1) / 2;
            return [bilinear(p00, p10, p01, p11, t, 0), bilinear(p00, p10, p01, p11, 0, t)];
          };
          for (let b = 0; b < bands; b += 2) {
            const s0 = -1 + (2 * b) / bands;
            const s1 = -1 + (2 * (b + 1)) / bands;
            const [a, bpt] = edge(s0);
            const [c, d] = edge(s1);
            marks.push(fill(quad(a, bpt, d, c), 0.85));
          }
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "hex-strands",
    name: "Hex strands",
    tags: ["grid", "flow"],
    note: "Hex cells swell and crowd along a noise field. Some of them carry a bundle of lines from edge to edge.",
    params: [
      P("columns", "Columns", 3, 18, 1, 8),
      P("rows", "Rows", 3, 16, 1, 8),
      P("swell", "Swell", 0, 1, 0.01, 0.35),
      P("strands", "Strands", 1, 7, 1, 3),
      P("seed", "Seed", 0, 999, 1, 4),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const strands = ival(v, "strands");
      const swell = val(v, "swell");
      const seed = ival(v, "seed");
      const size = 720 / Math.max(cols, rows * 0.9);
      const centers = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const px = size * Math.sqrt(3) * (x + (y % 2) * 0.5);
          const py = size * 1.5 * y;
          const n = noise2(x * 0.35, y * 0.35, seed);
          const m = noise2(x * 0.35 + 8, y * 0.35, seed + 2);
          centers.push({
            x: px + (n - 0.5) * size * swell,
            y: py + (m - 0.5) * size * swell,
            pick: noise2(x * 0.7, y * 0.7, seed + 5),
          });
        }
      }
      const map = frame(centers, 80);
      const marks = [];
      for (const c of centers) {
        const p = map(c);
        const r = size * 0.48 * (map({ x: c.x + size, y: c.y }).x - p.x > 0 ? 1 : 1);
        const rad = Math.min(36, Math.abs(map({ x: c.x + size * 0.45, y: c.y }).x - p.x));
        const corners = [];
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          corners.push({ x: p.x + Math.cos(a) * rad, y: p.y + Math.sin(a) * rad });
        }
        marks.push(stroke(poly(corners), 1));
        if (c.pick > 0.45) {
          for (let s = 0; s < strands; s += 1) {
            const t = strands === 1 ? 0.5 : s / (strands - 1);
            const a = lerpPt(corners[5], corners[0], t);
            const b = lerpPt(corners[2], corners[3], t);
            marks.push(stroke(line([a, p, b]), 0.8));
          }
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  deformed(
    "deformed-grid-mesh",
    "Deformed grid mesh",
    "A regular mesh is pushed by smooth noise until it reads as cloth.",
    { columns: 18, rows: 18, amount: 0.45, scale: 0.22, seed: 2 },
  ),
  deformed(
    "deformed-grid-mesh-2",
    "Deformed grid mesh II",
    "The same mesh, with tighter noise so the bends come quicker.",
    { columns: 16, rows: 16, amount: 0.28, scale: 0.55, seed: 51 },
  ),
  pattern({
    id: "ripple-grid",
    name: "Ripple grid",
    tags: ["grid", "flow", "physics"],
    note: "Grid points shift by a sine of their distance from a center, so the sheet freezes a ripple.",
    radiate: "amplitude",
    params: [
      P("columns", "Columns", 6, 40, 1, 22),
      P("rows", "Rows", 6, 40, 1, 22),
      P("amplitude", "Amplitude", 0, 40, 0.1, 14),
      P("frequency", "Frequency", 0.2, 8, 0.1, 2.4),
      P("phase", "Phase", 0, 6.2, 0.1, 0),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const amp = val(v, "amplitude");
      const freq = val(v, "frequency");
      const phase = val(v, "phase");
      const cell = 820 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const cx = 500;
      const cy = 500;
      const pts = [];
      for (let y = 0; y <= rows; y += 1) {
        const row = [];
        for (let x = 0; x <= cols; x += 1) {
          const px = ox + x * cell;
          const py = oy + y * cell;
          const d = Math.hypot(px - cx, py - cy);
          const wave = v.wave;
          const gate = typeof wave === "function" ? (wave.gain ?? 1) * wave(px, py) : 1;
          const w = Math.sin(d * freq * 0.02 + phase) * gate;
          const ang = Math.atan2(py - cy, px - cx);
          row.push({ x: px + Math.cos(ang) * w * amp, y: py + Math.sin(ang) * w * amp });
        }
        pts.push(row);
      }
      return { viewBox: sheet(), marks: meshLines(pts) };
    },
  }),
  pattern({
    id: "wavy-fabric",
    name: "Wavy fabric",
    tags: ["flow", "grid"],
    note: "Horizontal lines take one wave and vertical lines take another, so the crossings read as weave. Width and height set the sheet. Rows and columns set how many lines cross it.",
    radiate: "amplitude",
    params: [
      P("width", "Width", 160, 920, 1, 840),
      P("height", "Height", 160, 920, 1, 840),
      P("columns", "Columns", 4, 40, 1, 18),
      P("rows", "Rows", 4, 40, 1, 18),
      P("amplitude", "Amplitude", 0, 40, 0.1, 12),
      P("waves", "Waves", 0.5, 8, 0.1, 2.5),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const amp = val(v, "amplitude");
      const waves = val(v, "waves");
      const w = val(v, "width");
      const h = val(v, "height");
      const x0 = (1000 - w) / 2;
      const y0 = (1000 - h) / 2;
      const pad = 56;
      const marks = [];
      for (let y = 0; y <= rows; y += 1) {
        const pts = [];
        for (let x = 0; x <= cols * 4; x += 1) {
          const u = x / (cols * 4);
          const px = x0 + u * w;
          const py = y0 + (y / rows) * h;
          const local = driven(v, amp, 40, px, py);
          pts.push({ x: px, y: py + Math.sin(u * Math.PI * 2 * waves + y * 0.4) * local });
        }
        marks.push(stroke(line(pts)));
      }
      for (let x = 0; x <= cols; x += 1) {
        const pts = [];
        for (let y = 0; y <= rows * 4; y += 1) {
          const vv = y / (rows * 4);
          const px = x0 + (x / cols) * w;
          const py = y0 + vv * h;
          const local = driven(v, amp, 40, px, py);
          pts.push({ x: px + Math.sin(vv * Math.PI * 2 * waves + x * 0.35) * local, y: py });
        }
        marks.push(stroke(line(pts)));
      }
      return { viewBox: `${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`, marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "spiral-morph",
    name: "Spiral morph",
    tags: ["grid", "distortion"],
    note: "A rectangular grid and a spiral share one set of points. A slider blends them, and noise decides where the blend leads.",
    params: [
      P("columns", "Columns", 4, 28, 1, 14),
      P("rows", "Rows", 4, 28, 1, 14),
      P("morph", "Morph", 0, 1, 0.01, 0.55),
      P("turns", "Turns", 1, 8, 0.1, 3),
      P("seed", "Seed", 0, 999, 1, 6),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const morph = val(v, "morph");
      const turns = val(v, "turns");
      const seed = ival(v, "seed");
      const count = (cols + 1) * (rows + 1);
      const grid = [];
      for (let y = 0; y <= rows; y += 1) {
        for (let x = 0; x <= cols; x += 1) {
          grid.push({ x: 140 + (x / cols) * 720, y: 140 + (y / rows) * 720, x0: x, y0: y });
        }
      }
      const pts = grid.map((g, i) => {
        const t = i / Math.max(1, count - 1);
        const a = t * turns * Math.PI * 2;
        const rad = 30 + t * 430;
        const spiral = { x: 500 + Math.cos(a) * rad, y: 500 + Math.sin(a) * rad };
        const n = noise2(g.x0 * 0.2, g.y0 * 0.2, seed);
        const k = morph * (0.25 + n);
        return { x: g.x + (spiral.x - g.x) * k, y: g.y + (spiral.y - g.y) * k };
      });
      const at = (x, y) => pts[y * (cols + 1) + x];
      const marks = [];
      for (let y = 0; y <= rows; y += 1) marks.push(stroke(line(Array.from({ length: cols + 1 }, (_, x) => at(x, y)))));
      for (let x = 0; x <= cols; x += 1) marks.push(stroke(line(Array.from({ length: rows + 1 }, (_, y) => at(x, y)))));
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "jittery-squares-grid",
    name: "Jittery squares grid",
    tags: ["grid", "noise", "distortion"],
    note: "Squares sit still in the top rows and shake loose as they go down.",
    params: [
      P("columns", "Columns", 3, 20, 1, 10),
      P("rows", "Rows", 3, 20, 1, 10),
      P("jitter", "Jitter", 0, 1, 0.01, 0.7),
      P("seed", "Seed", 0, 999, 1, 5),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const jitter = val(v, "jitter");
      const seed = ival(v, "seed");
      const cell = 840 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        const fall = y / Math.max(1, rows - 1);
        for (let x = 0; x < cols; x += 1) {
          const n = noise2(x * 0.45, y * 0.45, seed);
          const m = noise2(x * 0.45 + 4, y * 0.45, seed + 1);
          const shift = fall * jitter * cell * 0.8;
          const cx = ox + x * cell + cell / 2 + (n - 0.5) * shift;
          const cy = oy + y * cell + cell / 2 + (m - 0.5) * shift;
          const rot = (n - 0.5) * fall * jitter * 0.8;
          const s = cell * 0.72;
          const corners = [
            { x: -s / 2, y: -s / 2 },
            { x: s / 2, y: -s / 2 },
            { x: s / 2, y: s / 2 },
            { x: -s / 2, y: s / 2 },
          ].map((p) => ({
            x: cx + p.x * Math.cos(rot) - p.y * Math.sin(rot),
            y: cy + p.x * Math.sin(rot) + p.y * Math.cos(rot),
          }));
          marks.push(stroke(poly(corners)));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "hiding-squares",
    name: "Hiding squares",
    tags: ["grid", "noise"],
    note: "Each cell holds a square. Noise slides, shrinks, and turns it so the cell corners show through.",
    params: [
      P("columns", "Columns", 3, 18, 1, 9),
      P("rows", "Rows", 3, 18, 1, 9),
      P("amount", "Amount", 0, 1, 0.01, 0.65),
      P("seed", "Seed", 0, 999, 1, 8),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const amount = val(v, "amount");
      const seed = ival(v, "seed");
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const n = noise2(x * 0.33, y * 0.33, seed);
          const slide = (n - 0.5) * amount * cell;
          const scale = 0.92 - n * amount * 0.55;
          const rot = (noise2(x * 0.33, y * 0.33, seed + 4) - 0.5) * amount;
          const cx = ox + (x + 0.5) * cell + slide;
          const cy = oy + (y + 0.5) * cell + slide * 0.6;
          const s = cell * scale;
          const corners = [-1, 1]
            .flatMap((sx) => [-1, 1].map((sy) => ({ x: sx, y: sy })))
            .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
            .map((p) => ({
              x: cx + (p.x * s) / 2 * Math.cos(rot) - (p.y * s) / 2 * Math.sin(rot),
              y: cy + (p.x * s) / 2 * Math.sin(rot) + (p.y * s) / 2 * Math.cos(rot),
            }));
          marks.push(fill(poly(corners), 0.9));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "backpack-grid",
    name: "Backpack grid",
    tags: ["grid", "organic"],
    note: "The sheet is packed into rectangles of mixed sizes, each one inset so a gap stays even.",
    params: [
      P("density", "Density", 2, 8, 1, 4),
      P("gap", "Gap", 2, 24, 1, 8),
      P("round", "Round", 0, 28, 1, 8),
      P("seed", "Seed", 0, 999, 1, 1),
    ],
    render(v) {
      const depth = ival(v, "density");
      const gap = val(v, "gap");
      const radius = val(v, "round");
      const rand = rng(ival(v, "seed") + 1);
      let rects = [{ x: 90, y: 90, w: 820, h: 820 }];
      for (let d = 0; d < depth; d += 1) {
        const next = [];
        for (const r of rects) {
          if (r.w < 70 || r.h < 70 || rand() < 0.15) {
            next.push(r);
            continue;
          }
          if (r.w > r.h) {
            const cut = r.w * (0.35 + rand() * 0.3);
            next.push({ x: r.x, y: r.y, w: cut, h: r.h }, { x: r.x + cut, y: r.y, w: r.w - cut, h: r.h });
          } else {
            const cut = r.h * (0.35 + rand() * 0.3);
            next.push({ x: r.x, y: r.y, w: r.w, h: cut }, { x: r.x, y: r.y + cut, w: r.w, h: r.h - cut });
          }
        }
        rects = next;
      }
      const marks = rects
        .map((r) => {
          const w = r.w - gap;
          const h = r.h - gap;
          if (w < 8 || h < 8) return null;
          return stroke(roundRect(r.x + gap / 2, r.y + gap / 2, w, h, radius));
        })
        .filter(Boolean);
      return { viewBox: sheet(), marks };
    },
  }),
  pattern({
    id: "rect-field-void",
    name: "Rectangle field void",
    tags: ["grid"],
    note: "Rectangles fill the sheet and step back from the middle, leaving a hole.",
    params: [
      P("columns", "Columns", 4, 24, 1, 12),
      P("rows", "Rows", 4, 24, 1, 12),
      P("void", "Void", 0, 0.8, 0.01, 0.34),
      P("seed", "Seed", 0, 999, 1, 9),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const hole = val(v, "void");
      const rand = rng(ival(v, "seed"));
      const cell = 880 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const cx = (x + 0.5) / cols - 0.5;
          const cy = (y + 0.5) / rows - 0.5;
          const dist = Math.hypot(cx, cy);
          if (dist < hole * 0.55) continue;
          const shrink = dist < hole ? (dist - hole * 0.55) / (hole * 0.45) : 1;
          const s = cell * 0.72 * shrink * (0.75 + rand() * 0.25);
          if (s < 4) continue;
          marks.push(stroke(poly([
            { x: ox + (x + 0.5) * cell - s / 2, y: oy + (y + 0.5) * cell - s / 2 },
            { x: ox + (x + 0.5) * cell + s / 2, y: oy + (y + 0.5) * cell - s / 2 },
            { x: ox + (x + 0.5) * cell + s / 2, y: oy + (y + 0.5) * cell + s / 2 },
            { x: ox + (x + 0.5) * cell - s / 2, y: oy + (y + 0.5) * cell + s / 2 },
          ])));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "triangular-mosaic",
    name: "Triangular mosaic",
    tags: ["grid", "noise"],
    note: "Half-square triangles lock into a pinwheel at the top and give way to chance further down.",
    params: [
      P("columns", "Columns", 4, 24, 1, 12),
      P("rows", "Rows", 4, 24, 1, 12),
      P("disorder", "Disorder", 0, 1, 0.01, 0.7),
      P("seed", "Seed", 0, 999, 1, 2),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const disorder = val(v, "disorder");
      const rand = rng(ival(v, "seed") + 3);
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const fall = y / Math.max(1, rows - 1);
          const ordered = (x + y) % 2;
          const useRandom = rand() < fall * disorder;
          const dir = useRandom ? Math.floor(rand() * 4) : ordered;
          const x0 = ox + x * cell;
          const y0 = oy + y * cell;
          const corners = [
            [{ x: x0, y: y0 }, { x: x0 + cell, y: y0 }, { x: x0, y: y0 + cell }],
            [{ x: x0 + cell, y: y0 }, { x: x0 + cell, y: y0 + cell }, { x: x0, y: y0 }],
            [{ x: x0, y: y0 + cell }, { x: x0 + cell, y: y0 + cell }, { x: x0 + cell, y: y0 }],
            [{ x: x0, y: y0 }, { x: x0, y: y0 + cell }, { x: x0 + cell, y: y0 + cell }],
          ];
          marks.push(fill(poly(corners[dir % 4]), 0.88));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "quarter-circles-grid",
    name: "Quarter circles grid",
    tags: ["grid"],
    note: "Quarter circles sit in a two-by-two tile and point toward the middle. Some tiles stay empty.",
    params: [
      P("columns", "Columns", 2, 16, 1, 8),
      P("rows", "Rows", 2, 16, 1, 8),
      P("density", "Density", 0, 1, 0.01, 0.75),
      P("seed", "Seed", 0, 999, 1, 4),
    ],
    render(v) {
      const cols = ival(v, "columns") * 2;
      const rows = ival(v, "rows") * 2;
      const density = val(v, "density");
      const rand = rng(ival(v, "seed"));
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (rand() > density) continue;
          const towardX = x % 2 === 0 ? 1 : 0;
          const towardY = y % 2 === 0 ? 1 : 0;
          const cx = ox + (x + towardX) * cell;
          const cy = oy + (y + towardY) * cell;
          const a0 = Math.atan2((y + 0.5) * cell + oy - cy, (x + 0.5) * cell + ox - cx) - Math.PI / 4;
          marks.push(stroke(arc(cx, cy, cell * 0.92, a0, a0 + Math.PI / 2), 1.4));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "arcs-1",
    name: "Rotating arc grid",
    tags: ["grid"],
    note: "Arcs on a grid each turn by their own angle, and the overlaps start to ripple.",
    params: [
      P("columns", "Columns", 3, 16, 1, 8),
      P("rows", "Rows", 3, 16, 1, 8),
      P("turn", "Turn", 0, 3.1, 0.01, 1.4),
      P("seed", "Seed", 0, 999, 1, 7),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const turn = val(v, "turn");
      const seed = ival(v, "seed");
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const n = noise2(x * 0.4, y * 0.4, seed);
          const a = (n - 0.5) * 2 * turn;
          const cx = ox + (x + 0.5) * cell;
          const cy = oy + (y + 0.5) * cell;
          marks.push(stroke(arc(cx, cy, cell * 0.42, a, a + Math.PI * 1.15)));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "concentric-arc-truchet-2",
    name: "Quarter arc Truchet",
    tags: ["grid", "flow"],
    note: "Each tile holds concentric quarter arcs from one corner, turned by quarter turns so the curves connect.",
    params: [
      P("columns", "Columns", 3, 14, 1, 8),
      P("rows", "Rows", 3, 14, 1, 8),
      P("rings", "Rings", 1, 5, 1, 3),
      P("seed", "Seed", 0, 999, 1, 2),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const rings = ival(v, "rings");
      const rand = rng(ival(v, "seed") + 1);
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const turn = Math.floor(rand() * 4);
          const cx = ox + (turn === 1 || turn === 2 ? x + 1 : x) * cell;
          const cy = oy + (turn === 2 || turn === 3 ? y + 1 : y) * cell;
          const a0 = (turn * Math.PI) / 2;
          for (let i = 1; i <= rings; i += 1) {
            marks.push(stroke(arc(cx, cy, (cell * i) / (rings + 0.4), a0, a0 + Math.PI / 2), 1.3));
          }
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "concentric-arc-truchet-3",
    name: "Arc Truchet butterfly",
    tags: ["grid", "flow"],
    note: "Each tile is a pair of mirrored semicircles. The turn alternates by column and row so paths keep flowing.",
    params: [
      P("columns", "Columns", 3, 14, 1, 8),
      P("rows", "Rows", 3, 14, 1, 8),
      P("rings", "Rings", 1, 5, 1, 3),
      P("offset", "Offset", 0, 1, 0.01, 0),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const rings = ival(v, "rings");
      const offset = val(v, "offset");
      const cell = 860 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const turn = (x + y + (offset > 0.5 ? 1 : 0)) % 2;
          const cx = ox + (x + 0.5) * cell;
          const cy = oy + (y + 0.5) * cell;
          for (let i = 1; i <= rings; i += 1) {
            const r = (cell * 0.48 * i) / rings;
            const a = turn ? 0 : Math.PI / 2;
            marks.push(stroke(arc(cx - (turn ? 0 : cell / 2), cy - (turn ? cell / 2 : 0), r, a, a + Math.PI), 1.1));
            marks.push(stroke(arc(cx + (turn ? 0 : cell / 2), cy + (turn ? cell / 2 : 0), r, a + Math.PI, a + Math.PI * 2), 1.1));
          }
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "chevron-blocks",
    name: "Chevron blocks",
    tags: ["isometric", "grid"],
    note: "Hex cells split into three ruled faces. Some faces run straight and read as a block. Others fold on the diagonal.",
    params: [
      P("columns", "Columns", 3, 12, 1, 6),
      P("rows", "Rows", 3, 12, 1, 6),
      P("bands", "Bands", 2, 8, 1, 4),
      P("fold", "Fold", 0, 1, 0.01, 0.45),
      P("seed", "Seed", 0, 999, 1, 3),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const bands = ival(v, "bands");
      const fold = val(v, "fold");
      const seed = ival(v, "seed");
      const size = 760 / Math.max(cols, rows);
      const marks = [];
      const centers = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          centers.push({
            x: size * Math.sqrt(3) * (x + (y % 2) * 0.5),
            y: size * 1.5 * y,
            gx: x,
            gy: y,
          });
        }
      }
      const map = frame(centers, 90);
      for (const c of centers) {
        const p = map(c);
        const rad = Math.abs(map({ x: c.x + size * 0.5, y: c.y }).x - p.x);
        const corners = [];
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          corners.push({ x: p.x + Math.cos(a) * rad, y: p.y + Math.sin(a) * rad });
        }
        for (let f = 0; f < 3; f += 1) {
          const a = corners[f];
          const b = corners[f + 1];
          const mitre = noise2(c.gx * 0.5 + f, c.gy * 0.5, seed) < fold;
          for (let i = 1; i < bands; i += 1) {
            const t = i / bands;
            if (mitre) {
              marks.push(stroke(line([lerpPt(p, a, t), lerpPt(p, b, t)]), 0.9));
            } else {
              marks.push(stroke(line([lerpPt(a, b, t), lerpPt(p, lerpPt(a, b, 0.5), t)]), 0.9));
            }
          }
          marks.push(stroke(poly([p, a, b]), 1));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "isometric-ribbon-grid",
    name: "Isometric ribbon grid",
    tags: ["isometric", "noise", "grid"],
    note: "A field of isometric triangles. Noise keeps some parallelograms and lets the rest go.",
    params: [
      P("columns", "Columns", 4, 20, 1, 12),
      P("rows", "Rows", 4, 20, 1, 10),
      P("density", "Density", 0, 1, 0.01, 0.55),
      P("seed", "Seed", 0, 999, 1, 6),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const density = val(v, "density");
      const seed = ival(v, "seed");
      const raw = [];
      for (let y = 0; y <= rows; y += 1) {
        for (let x = 0; x <= cols; x += 1) raw.push(projectIso(x, y, 0));
      }
      const map = frame(raw, 80);
      const at = (x, y) => map(projectIso(x, y, 0));
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (noise2(x * 0.45, y * 0.45, seed) > density) continue;
          const a = at(x, y);
          const b = at(x + 1, y);
          const c = at(x, y + 1);
          const d = at(x + 1, y + 1);
          marks.push(fill(poly([a, b, d, c]), 0.75));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "masked-letter-grid",
    name: "Masked letter grid",
    tags: ["grid", "distortion"],
    note: "A grid is kept only where it crosses the word you type.",
    params: [
      { key: "text", label: "Text", type: "text", value: "A" },
      P("lines", "Lines", 8, 60, 1, 28),
      P("weight", "Weight", 0.02, 0.12, 0.01, 0.055),
      P("shift", "Shift", 0, 1, 0.01, 0.2),
    ],
    render(v) {
      const lines = ival(v, "lines");
      const weight = val(v, "weight");
      const shift = val(v, "shift");
      const inside = maskFor(v.text, weight);
      const marks = [];
      for (let i = 0; i <= lines; i += 1) {
        const y = 120 + (i / lines) * 760;
        let run = [];
        for (let x = 160; x <= 840; x += 6) {
          const yy = y + Math.sin(x * 0.02 + i) * 10 * shift;
          if (inside(x, yy)) run.push({ x, y: yy });
          else if (run.length > 1) {
            marks.push(stroke(line(run)));
            run = [];
          } else run = [];
        }
        if (run.length > 1) marks.push(stroke(line(run)));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
];
