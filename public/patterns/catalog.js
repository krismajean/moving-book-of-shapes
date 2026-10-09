import { fieldPatterns } from "./fields.js";
import { flowPatterns } from "./flow.js";
import { isoPatterns } from "./iso.js";
import { radialPatterns } from "./radial.js";
import { wovenGrid } from "./woven-grid.js";

const order = [
  "woven-grid",
  "ribbon-grid",
  "hex-strands",
  "flow-dots",
  "flow-lines",
  "flow-poles",
  "chevron-blocks",
  "triangular-mosaic",
  "node-garden",
  "interference-mesh",
  "spiral-morph",
  "nested-polygons-filled",
  "concentric-arc-truchet-2",
  "concentric-arc-truchet-3",
  "iso-cross",
  "scattered-cube-grid-v3",
  "iso-cube-wireframe",
  "iso-sphere",
  "scattered-cube-grid",
  "backpack-grid",
  "wave-field",
  "brockmann-arcs",
  "hiding-squares",
  "isometric-ribbon-grid",
  "jittery-squares-grid",
  "quarter-circles-grid",
  "wavy-lines-converging",
  "joy-division",
  "joy-division-mesh",
  "arcs-1",
  "chaos-circles",
  "concentric-noise-rings",
  "deformed-grid-mesh",
  "deformed-grid-mesh-2",
  "dna-helix",
  "halftone-sphere",
  "iso-test-noise-field",
  "iso-test-noise-field-2",
  "isometric-cube-grid",
  "isometric-cubes",
  "line-based-circles",
  "lissajous-field",
  "masked-letter-grid",
  "modular-circle",
  "nested-polygons",
  "noise-circle-1",
  "noise-landscape-1",
  "phyllotaxis-bloom",
  "polar-mesh",
  "radial-harmony",
  "radial-spokes",
  "rect-field-void",
  "ripple-grid",
  "rose-mesh",
  "resonance-field",
  "signal-decay",
  "sine-cube",
  "spiral-dot-field",
  "spiral-mesh",
  "wavy-fabric",
];

const all = [wovenGrid, ...fieldPatterns, ...flowPatterns, ...radialPatterns, ...isoPatterns];
const byId = new Map(all.map((item) => [item.id, item]));

export const patterns = order.map((id) => {
  const item = byId.get(id);
  if (!item) throw new Error(`Missing pattern ${id}`);
  return item;
});

export function patternById(id) {
  return byId.get(id) || null;
}
