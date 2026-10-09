import {
  P,
  arc,
  circle,
  fill,
  ival,
  line,
  noise2,
  pattern,
  poly,
  rng,
  sheet,
  stroke,
  val,
} from "../lib/geom.js";

function ringMarks(count, place) {
  const marks = [];
  for (let i = 0; i < count; i += 1) {
    const mark = place(i, count);
    if (Array.isArray(mark)) marks.push(...mark.filter(Boolean));
    else if (mark) marks.push(mark);
  }
  return marks;
}

function loop(samples, at) {
  const pts = [];
  for (let i = 0; i <= samples; i += 1) pts.push(at((i / samples) * Math.PI * 2));
  return stroke(line(pts));
}

export const radialPatterns = [
  pattern({
    id: "radial-spokes",
    name: "Radial spokes",
    tags: ["radial"],
    note: "Equal lines leave a center, like a wheel.",
    params: [P("count", "Count", 4, 64, 1, 24), P("inner", "Inner", 0, 200, 1, 20), P("length", "Length", 40, 420, 1, 340)],
    render(v) {
      const count = ival(v, "count");
      const inner = val(v, "inner");
      const length = val(v, "length");
      return {
        viewBox: sheet(),
        marks: ringMarks(count, (i) => {
          const a = (i / count) * Math.PI * 2;
          return stroke(line([
            { x: 500 + Math.cos(a) * inner, y: 500 + Math.sin(a) * inner },
            { x: 500 + Math.cos(a) * (inner + length), y: 500 + Math.sin(a) * (inner + length) },
          ]));
        }),
      };
    },
  }),
  pattern({
    id: "polar-mesh",
    name: "Polar mesh",
    tags: ["radial", "grid"],
    note: "Rings and spokes, drawn in polar space instead of a square grid.",
    params: [P("rings", "Rings", 2, 16, 1, 7), P("spokes", "Spokes", 4, 36, 1, 16)],
    render(v) {
      const rings = ival(v, "rings");
      const spokes = ival(v, "spokes");
      const marks = ringMarks(rings, (i) => loop(spokes, (a) => ({
        x: 500 + Math.cos(a) * (40 + ((i + 1) / rings) * 380),
        y: 500 + Math.sin(a) * (40 + ((i + 1) / rings) * 380),
      })));
      marks.push(...ringMarks(spokes, (i) => {
        const a = (i / spokes) * Math.PI * 2;
        return stroke(line([
          { x: 500 + Math.cos(a) * 40, y: 500 + Math.sin(a) * 40 },
          { x: 500 + Math.cos(a) * 420, y: 500 + Math.sin(a) * 420 },
        ]));
      }));
      return { viewBox: sheet(), marks };
    },
  }),
  pattern({
    id: "radial-harmony",
    name: "Radial harmony",
    tags: ["radial"],
    note: "Circles cut into even slices.",
    params: [P("rings", "Rings", 1, 10, 1, 5), P("slices", "Slices", 4, 24, 1, 12)],
    render(v) {
      const rings = ival(v, "rings");
      const slices = ival(v, "slices");
      const marks = ringMarks(rings, (i) => stroke(circle(500, 500, 50 + ((i + 1) / rings) * 370)));
      marks.push(...ringMarks(slices, (i) => {
        const a = (i / slices) * Math.PI * 2;
        return stroke(line([
          { x: 500, y: 500 },
          { x: 500 + Math.cos(a) * 420, y: 500 + Math.sin(a) * 420 },
        ]));
      }));
      return { viewBox: sheet(), marks };
    },
  }),
  pattern({
    id: "modular-circle",
    name: "Modular circle",
    tags: ["radial"],
    note: "The same circle, repeated and nested.",
    params: [P("count", "Count", 3, 16, 1, 8), P("gap", "Gap", 8, 40, 1, 22)],
    render(v) {
      const count = ival(v, "count");
      const gap = val(v, "gap");
      return { viewBox: sheet(), marks: ringMarks(count, (i) => stroke(circle(500, 500, 40 + i * gap), 1.2)) };
    },
  }),
  pattern({
    id: "nested-polygons",
    name: "Nested polygons",
    tags: ["radial"],
    note: "One polygon, drawn again and again, each copy smaller and sharing the same corners.",
    params: [P("sides", "Sides", 3, 12, 1, 6), P("rings", "Rings", 2, 14, 1, 7), P("turn", "Turn", 0, 1, 0.01, 0)],
    render(v) {
      const sides = ival(v, "sides");
      const rings = ival(v, "rings");
      const turn = val(v, "turn") * Math.PI;
      return {
        viewBox: sheet(),
        marks: ringMarks(rings, (i) => {
          const r = 40 + ((i + 1) / rings) * 380;
          const pts = [];
          for (let s = 0; s < sides; s += 1) {
            const a = turn + (s / sides) * Math.PI * 2 - Math.PI / 2;
            pts.push({ x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r });
          }
          return stroke(poly(pts));
        }),
      };
    },
  }),
  pattern({
    id: "nested-polygons-filled",
    name: "Broken ring",
    tags: ["radial", "noise"],
    note: "Quads between two polygons. Noise knocks some of them out, so the ring looks broken.",
    params: [
      P("sides", "Sides", 3, 16, 1, 8),
      P("rings", "Rings", 2, 12, 1, 6),
      P("density", "Density", 0, 1, 0.01, 0.62),
      P("seed", "Seed", 0, 999, 1, 4),
    ],
    render(v) {
      const sides = ival(v, "sides");
      const rings = ival(v, "rings");
      const density = val(v, "density");
      const seed = ival(v, "seed");
      const marks = [];
      const at = (ring, side) => {
        const r = 70 + (ring / rings) * 360;
        const a = (side / sides) * Math.PI * 2 - Math.PI / 2;
        return { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
      };
      for (let ring = 0; ring < rings; ring += 1) {
        for (let side = 0; side < sides; side += 1) {
          if (noise2(side * 0.4, ring * 0.4, seed) > density) continue;
          marks.push(fill(poly([at(ring, side), at(ring, side + 1), at(ring + 1, side + 1), at(ring + 1, side)]), 0.85));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "noise-circle-1",
    name: "Noise circle",
    tags: ["radial", "noise", "organic"],
    note: "A circle whose outline is shoved around by noise.",
    params: [P("amount", "Amount", 0, 1, 0.01, 0.35), P("scale", "Scale", 0.2, 4, 0.01, 1.2), P("seed", "Seed", 0, 999, 1, 3)],
    render(v) {
      const amount = val(v, "amount");
      const scale = val(v, "scale");
      const seed = ival(v, "seed");
      return {
        viewBox: sheet(),
        marks: [loop(80, (a) => {
          const n = noise2(Math.cos(a) * scale + 2, Math.sin(a) * scale, seed);
          const r = 280 + (n - 0.5) * 220 * amount;
          return { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
        })].filter(Boolean),
      };
    },
  }),
  pattern({
    id: "concentric-noise-rings",
    name: "Concentric noise rings",
    tags: ["radial", "noise"],
    note: "Nested rings, each one warped by the same kind of noise.",
    params: [
      P("rings", "Rings", 2, 14, 1, 7),
      P("amount", "Amount", 0, 1, 0.01, 0.3),
      P("seed", "Seed", 0, 999, 1, 5),
    ],
    render(v) {
      const rings = ival(v, "rings");
      const amount = val(v, "amount");
      const seed = ival(v, "seed");
      return {
        viewBox: sheet(),
        marks: ringMarks(rings, (i) => loop(72, (a) => {
          const n = noise2(Math.cos(a) * 1.4, Math.sin(a) * 1.4 + i, seed);
          const r = 40 + ((i + 1) / rings) * 380 + (n - 0.5) * 70 * amount;
          return { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
        })),
      };
    },
  }),
  pattern({
    id: "line-based-circles",
    name: "Line-based circles",
    tags: ["radial"],
    note: "Circles built from straight segments, so the curve stays visibly made of lines.",
    params: [P("rings", "Rings", 1, 8, 1, 4), P("sides", "Sides", 5, 24, 1, 10)],
    render(v) {
      const rings = ival(v, "rings");
      const sides = ival(v, "sides");
      return {
        viewBox: sheet(),
        marks: ringMarks(rings, (i) => {
          const r = 60 + ((i + 1) / rings) * 360;
          const pts = [];
          for (let s = 0; s <= sides; s += 1) {
            const a = (s / sides) * Math.PI * 2;
            pts.push({ x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r });
          }
          return stroke(line(pts));
        }),
      };
    },
  }),
  pattern({
    id: "chaos-circles",
    name: "Chaos circles",
    tags: ["radial", "organic"],
    note: "Circles that start on a grid and then get nudged off it.",
    params: [
      P("columns", "Columns", 3, 12, 1, 6),
      P("rows", "Rows", 3, 12, 1, 6),
      P("jitter", "Jitter", 0, 1, 0.01, 0.45),
      P("seed", "Seed", 0, 999, 1, 2),
    ],
    render(v) {
      const cols = ival(v, "columns");
      const rows = ival(v, "rows");
      const jitter = val(v, "jitter");
      const rand = rng(ival(v, "seed") + 1);
      const cell = 800 / Math.max(cols, rows);
      const ox = (1000 - cell * cols) / 2;
      const oy = (1000 - cell * rows) / 2;
      const marks = [];
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const cx = ox + (x + 0.5) * cell + (rand() - 0.5) * cell * jitter;
          const cy = oy + (y + 0.5) * cell + (rand() - 0.5) * cell * jitter;
          marks.push(stroke(circle(cx, cy, cell * 0.28 * (0.7 + rand() * 0.5))));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "halftone-sphere",
    name: "Halftone sphere",
    tags: ["radial"],
    note: "Dots on a disk, larger where a sphere would face the light.",
    params: [P("columns", "Columns", 8, 28, 1, 16), P("light", "Light", -1, 1, 0.01, 0.45)],
    render(v) {
      const n = ival(v, "columns");
      const light = val(v, "light");
      const marks = [];
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const u = (x + 0.5) / n * 2 - 1;
          const w = (y + 0.5) / n * 2 - 1;
          const r2 = u * u + w * w;
          if (r2 > 1) continue;
          const z = Math.sqrt(1 - r2);
          const shade = Math.max(0.08, z * 0.7 + u * light);
          const cx = 500 + u * 340;
          const cy = 500 + w * 340;
          marks.push(fill(circle(cx, cy, (300 / n) * shade), 0.92));
        }
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "phyllotaxis-bloom",
    name: "Phyllotaxis bloom",
    tags: ["radial", "organic"],
    note: "Dots packed by the golden angle, the way seeds sit in a sunflower.",
    params: [P("count", "Count", 40, 400, 1, 180), P("spread", "Spread", 4, 24, 0.1, 14), P("dot", "Dot", 1, 8, 0.1, 3.5)],
    render(v) {
      const count = ival(v, "count");
      const spread = val(v, "spread");
      const dot = val(v, "dot");
      const golden = Math.PI * (3 - Math.sqrt(5));
      return {
        viewBox: sheet(),
        marks: ringMarks(count, (i) => {
          const r = spread * Math.sqrt(i + 1);
          const a = i * golden;
          return fill(circle(500 + Math.cos(a) * r, 500 + Math.sin(a) * r, dot), 0.9);
        }),
      };
    },
  }),
  pattern({
    id: "spiral-dot-field",
    name: "Spiral dot field",
    tags: ["radial", "organic"],
    note: "Dots walking out along a spiral.",
    params: [P("count", "Count", 30, 300, 1, 140), P("turns", "Turns", 1, 10, 0.1, 4), P("dot", "Dot", 1, 8, 0.1, 3)],
    render(v) {
      const count = ival(v, "count");
      const turns = val(v, "turns");
      const dot = val(v, "dot");
      return {
        viewBox: sheet(),
        marks: ringMarks(count, (i) => {
          const t = i / Math.max(1, count - 1);
          const a = t * turns * Math.PI * 2;
          const r = 16 + t * 400;
          return fill(circle(500 + Math.cos(a) * r, 500 + Math.sin(a) * r, dot), 0.9);
        }),
      };
    },
  }),
  pattern({
    id: "spiral-mesh",
    name: "Spiral mesh",
    tags: ["radial", "flow"],
    note: "A mesh that follows a spiral instead of a square grid.",
    params: [P("turns", "Turns", 1, 8, 0.1, 3.5), P("arms", "Arms", 2, 12, 1, 6), P("steps", "Steps", 8, 40, 1, 24)],
    render(v) {
      const turns = val(v, "turns");
      const arms = ival(v, "arms");
      const steps = ival(v, "steps");
      const at = (arm, step) => {
        const t = step / steps;
        const a = t * turns * Math.PI * 2 + (arm / arms) * Math.PI * 2;
        const r = 20 + t * 400;
        return { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
      };
      const marks = ringMarks(arms, (arm) => stroke(line(Array.from({ length: steps + 1 }, (_, step) => at(arm, step)))));
      for (let step = 0; step <= steps; step += 2) {
        marks.push(stroke(line(Array.from({ length: arms + 1 }, (_, arm) => at(arm, step)))));
      }
      return { viewBox: sheet(), marks: marks.filter(Boolean) };
    },
  }),
  pattern({
    id: "rose-mesh",
    name: "Rose mesh",
    tags: ["radial", "organic"],
    note: "A flower curve, r = cos(kθ), drawn as a set of petals.",
    params: [P("petals", "Petals", 2, 9, 1, 5), P("layers", "Layers", 1, 6, 1, 3)],
    render(v) {
      const k = ival(v, "petals");
      const layers = ival(v, "layers");
      return {
        viewBox: sheet(),
        marks: ringMarks(layers, (layer) => loop(180, (a) => {
          const r = Math.cos(k * a) * (140 + layer * 70);
          return { x: 500 + Math.cos(a) * r, y: 500 + Math.sin(a) * r };
        })),
      };
    },
  }),
  pattern({
    id: "brockmann-arcs",
    name: "Brockmann Beethoven arcs",
    tags: ["radial"],
    study: true,
    note: "Study only. Do not publish. Concentric arcs that thicken outward, with angles snapped to a step. After the Müller-Brockmann poster.",
    params: [
      P("arcs", "Arcs", 6, 28, 1, 14),
      P("step", "Angle step", 5, 30, 1, 15),
      P("sweep", "Sweep", 20, 180, 1, 90),
      P("seed", "Seed", 0, 999, 1, 1),
    ],
    render(v) {
      const arcs = ival(v, "arcs");
      const step = val(v, "step") * (Math.PI / 180);
      const sweep = val(v, "sweep") * (Math.PI / 180);
      const rand = rng(ival(v, "seed") + 1);
      const quant = (a) => Math.round(a / step) * step;
      return {
        viewBox: sheet(),
        marks: ringMarks(arcs, (i) => {
          const t = (i + 1) / arcs;
          const r = 40 + t * 400;
          const a0 = quant(rand() * Math.PI * 2);
          return stroke(arc(500, 500, r, a0, a0 + quant(sweep * (0.5 + t))), 0.6 + t * 3);
        }),
      };
    },
  }),
];
