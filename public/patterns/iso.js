import { P, cubesToMarks, ival, noise2, pattern, rng, sheet, val } from "../lib/geom.js";

function isoCubes(meta, build, mode = "solid") {
  return pattern({
    ...meta,
    render(v) {
      return { viewBox: sheet(), marks: cubesToMarks(build(v), mode) };
    },
  });
}

function rangeCubes(n, keep, size = 0.92) {
  const cubes = [];
  const mid = (n - 1) / 2;
  for (let z = 0; z < n; z += 1) {
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        if (keep(x, y, z, n, mid)) cubes.push({ x, y, z, s: size });
      }
    }
  }
  return cubes;
}

const sizeParam = P("size", "Size", 3, 12, 1, 7);

function noiseField(id, name, note, scale, height) {
  return isoCubes(
    {
      id,
      name,
      tags: ["isometric", "noise"],
      note,
      params: [
        P("size", "Size", 4, 16, 1, 10),
        P("height", "Height", 0, 4, 0.01, height),
        P("scale", "Scale", 0.05, 0.8, 0.01, scale),
        P("seed", "Seed", 0, 999, 1, 1),
      ],
    },
    (v) => {
      const n = ival(v, "size");
      const cubes = [];
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const h = noise2(x * val(v, "scale"), y * val(v, "scale"), ival(v, "seed"));
          cubes.push({ x, y, z: 0, s: { x: 0.92, y: 0.92, z: 0.2 + h * val(v, "height") } });
        }
      }
      return cubes;
    },
  );
}

export const isoPatterns = [
  isoCubes(
    {
      id: "isometric-cube-grid",
      name: "Isometric cube grid",
      tags: ["isometric", "grid"],
      note: "A solid block of cubes in isometric view.",
      params: [sizeParam],
    },
    (v) => rangeCubes(ival(v, "size"), () => true),
  ),
  isoCubes(
    {
      id: "isometric-cubes",
      name: "Isometric cubes",
      tags: ["isometric"],
      note: "Columns of cubes, with a gap you can open between them.",
      params: [P("columns", "Columns", 2, 8, 1, 4), P("rows", "Rows", 2, 8, 1, 4), P("height", "Height", 1, 6, 1, 3), P("gap", "Gap", 0, 0.8, 0.01, 0.15)],
    },
    (v) => {
      const gap = val(v, "gap");
      const step = 1 + gap;
      const cubes = [];
      for (let y = 0; y < ival(v, "rows"); y += 1) {
        for (let x = 0; x < ival(v, "columns"); x += 1) {
          for (let z = 0; z < ival(v, "height"); z += 1) cubes.push({ x: x * step, y: y * step, z, s: 0.92 });
        }
      }
      return cubes;
    },
  ),
  isoCubes(
    {
      id: "iso-cross",
      name: "Iso cross",
      tags: ["isometric"],
      note: "Cubes stay only when they sit on the center of the block, which leaves a cross.",
      params: [sizeParam],
    },
    (v) => rangeCubes(ival(v, "size"), (x, y, z, n, mid) => x === Math.round(mid) || y === Math.round(mid) || z === Math.round(mid)),
  ),
  isoCubes(
    {
      id: "iso-cube-wireframe",
      name: "Iso cube wireframe",
      tags: ["isometric"],
      note: "Only the twelve edges of a big cube, built from small ones.",
      params: [sizeParam],
    },
    (v) => rangeCubes(ival(v, "size"), (x, y, z, n) => {
      const edge = (a) => a === 0 || a === n - 1;
      return [edge(x), edge(y), edge(z)].filter(Boolean).length >= 2;
    }, 0.92),
    "wire",
  ),
  isoCubes(
    {
      id: "iso-sphere",
      name: "Iso sphere",
      tags: ["isometric", "radial"],
      note: "The same cube block, with anything outside a sphere cut away.",
      params: [sizeParam],
    },
    (v) => rangeCubes(ival(v, "size"), (x, y, z, n, mid) => {
      const r = n * 0.48;
      return (x - mid) ** 2 + (y - mid) ** 2 + (z - mid) ** 2 <= r * r;
    }),
  ),
  isoCubes(
    {
      id: "scattered-cube-grid",
      name: "Scattered cube grid",
      tags: ["isometric", "noise", "distortion"],
      note: "A cube block with cells left empty at random.",
      params: [sizeParam, P("density", "Density", 0, 1, 0.01, 0.45), P("seed", "Seed", 0, 999, 1, 3)],
    },
    (v) => {
      const rand = rng(ival(v, "seed") + 1);
      const density = val(v, "density");
      return rangeCubes(ival(v, "size"), () => rand() < density);
    },
  ),
  isoCubes(
    {
      id: "scattered-cube-grid-v3",
      name: "Scattered cube grid v3",
      tags: ["isometric", "noise", "distortion"],
      note: "Every cube is pushed outward from the center. Noise changes how far each one goes.",
      params: [sizeParam, P("push", "Push", 0, 1.5, 0.01, 0.6), P("seed", "Seed", 0, 999, 1, 2)],
    },
    (v) => {
      const n = ival(v, "size");
      const push = val(v, "push");
      const seed = ival(v, "seed");
      const mid = (n - 1) / 2;
      return rangeCubes(n, () => true).map((cube) => {
        const nse = noise2(cube.x * 0.35, cube.y * 0.35 + cube.z, seed);
        const k = push * (0.4 + nse);
        return {
          x: mid + (cube.x - mid) * (1 + k),
          y: mid + (cube.y - mid) * (1 + k),
          z: cube.z * (1 + k * 0.4),
          s: 0.92,
        };
      });
    },
  ),
  noiseField("iso-test-noise-field", "Isometric noise field", "Cube heights follow noise, so the grid reads as a landscape.", 0.28, 2.2),
  noiseField(
    "iso-test-noise-field-2",
    "Isometric noise field II",
    "The same landscape, with a finer noise.",
    0.55,
    1.4,
  ),
  isoCubes(
    {
      id: "dna-helix",
      name: "Cube helix",
      tags: ["isometric", "flow"],
      note: "Two strands of cubes winding around each other.",
      params: [P("count", "Count", 12, 48, 1, 28), P("turns", "Turns", 1, 5, 0.1, 2.2), P("twist", "Twist", 0, 1, 0.01, 0.25), P("seed", "Seed", 0, 999, 1, 1)],
    },
    (v) => {
      const count = ival(v, "count");
      const turns = val(v, "turns");
      const twist = val(v, "twist");
      const seed = ival(v, "seed");
      const cubes = [];
      for (let strand = 0; strand < 2; strand += 1) {
        for (let i = 0; i < count; i += 1) {
          const t = i / count;
          const a = t * turns * Math.PI * 2 + strand * Math.PI + (noise2(i * 0.2, strand, seed) - 0.5) * twist;
          cubes.push({ x: Math.cos(a) * 2.2 + 3, y: Math.sin(a) * 2.2 + 3, z: t * 8, s: 0.55 });
        }
      }
      return cubes;
    },
  ),
  isoCubes(
    {
      id: "sine-cube",
      name: "Sine cube",
      tags: ["isometric", "flow"],
      note: "Cubes ride a sine wave through isometric space.",
      params: [P("count", "Count", 8, 32, 1, 16), P("amplitude", "Amplitude", 0, 2, 0.01, 0.8), P("waves", "Waves", 0.5, 4, 0.1, 1.5)],
    },
    (v) => {
      const count = ival(v, "count");
      const amp = val(v, "amplitude");
      const waves = val(v, "waves");
      const cubes = [];
      for (let i = 0; i < count; i += 1) {
        const t = i / Math.max(1, count - 1);
        cubes.push({ x: t * 8, y: 2 + Math.sin(t * waves * Math.PI * 2) * amp * 2, z: 1 + Math.cos(t * waves * Math.PI * 2) * amp, s: 0.7 });
      }
      return cubes;
    },
  ),
];
