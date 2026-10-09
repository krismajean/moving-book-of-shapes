export function rng(seed) {
  let a = (Number(seed) || 0) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function val(values, key) {
  const n = Number(values[key]);
  return Number.isFinite(n) ? n : 0;
}

export function ival(values, key) {
  return Math.round(val(values, key));
}

export function P(key, label, min, max, step, value) {
  return { key, label, min, max, step, value };
}

function hash(ix, iy, seed) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed | 0, 1440672139);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise2(x, y, seed = 1) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpPt(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function bilinear(p00, p10, p01, p11, u, v) {
  return {
    x: p00.x * (1 - u) * (1 - v) + p10.x * u * (1 - v) + p01.x * (1 - u) * v + p11.x * u * v,
    y: p00.y * (1 - u) * (1 - v) + p10.y * u * (1 - v) + p01.y * (1 - u) * v + p11.y * u * v,
  };
}

export function line(points) {
  let d = "";
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    d += `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

export function poly(points) {
  if (!points.length) return "";
  return `${line(points)}Z`;
}

export function circle(cx, cy, r) {
  if (r <= 0.2) return "";
  return `M${(cx + r).toFixed(2)} ${cy.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx - r).toFixed(2)} ${cy.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(cx + r).toFixed(2)} ${cy.toFixed(2)}`;
}

export function arc(cx, cy, r, a0, a1) {
  if (r <= 0.2) return "";
  const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 10)));
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return line(pts);
}

export function roundRect(x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius < 0.5) return poly([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]);
  return `M${(x + radius).toFixed(2)} ${y.toFixed(2)}H${(x + w - radius).toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${(x + w).toFixed(2)} ${(y + radius).toFixed(2)}V${(y + h - radius).toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${(x + w - radius).toFixed(2)} ${(y + h).toFixed(2)}H${(x + radius).toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x.toFixed(2)} ${(y + h - radius).toFixed(2)}V${(y + radius).toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${(x + radius).toFixed(2)} ${y.toFixed(2)}Z`;
}

export function stroke(d, sw = 1.15) {
  if (!d) return null;
  return { d, fill: "none", stroke: "currentColor", sw };
}

export function fill(d, opacity = 1) {
  if (!d) return null;
  return { d, fill: "currentColor", stroke: "none", sw: 0, opacity };
}

export function projectIso(x, y, z) {
  return { x: (x - y) * 0.866, y: (x + y) * 0.5 - z };
}

export function cubeFaces(x, y, z, s) {
  const sx = s.x ?? s;
  const sy = s.y ?? s;
  const sz = s.z ?? s;
  const p = (X, Y, Z) => projectIso(X, Y, Z);
  return {
    top: [p(x, y, z + sz), p(x + sx, y, z + sz), p(x + sx, y + sy, z + sz), p(x, y + sy, z + sz)],
    right: [p(x + sx, y, z), p(x + sx, y + sy, z), p(x + sx, y + sy, z + sz), p(x + sx, y, z + sz)],
    left: [p(x, y + sy, z), p(x + sx, y + sy, z), p(x + sx, y + sy, z + sz), p(x, y + sy, z + sz)],
  };
}

export function layout(cols, rows, margin = 80) {
  const cell = (1000 - margin * 2) / Math.max(cols, rows, 1);
  return { cell, ox: (1000 - cell * cols) / 2, oy: (1000 - cell * rows) / 2 };
}

export function pointGrid(cols, rows, place) {
  const pts = [];
  for (let y = 0; y <= rows; y += 1) {
    const row = [];
    for (let x = 0; x <= cols; x += 1) row.push(place(x, y));
    pts.push(row);
  }
  return pts;
}

export function meshLines(pts) {
  const marks = [];
  for (const row of pts) {
    const mark = stroke(line(row));
    if (mark) marks.push(mark);
  }
  const width = pts[0] ? pts[0].length : 0;
  for (let x = 0; x < width; x += 1) {
    const mark = stroke(line(pts.map((row) => row[x])));
    if (mark) marks.push(mark);
  }
  return marks;
}

export function frame(points, pad = 70) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return () => ({ x: 500, y: 500 });
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const s = (1000 - pad * 2) / Math.max(w, h);
  const ox = (1000 - w * s) / 2 - minX * s;
  const oy = (1000 - h * s) / 2 - minY * s;
  return (p) => ({ x: p.x * s + ox, y: p.y * s + oy });
}

export function cubesToMarks(cubes, mode = "solid") {
  const sorted = [...cubes].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
  const faces = [];
  for (const cube of sorted) {
    const s = cube.s ?? 1;
    const parts = cubeFaces(cube.x, cube.y, cube.z, s);
    if (mode === "wire") {
      faces.push({ pts: parts.top, wire: true });
      faces.push({ pts: parts.right, wire: true });
      faces.push({ pts: parts.left, wire: true });
    } else {
      faces.push({ pts: parts.top, opacity: 0.95 });
      faces.push({ pts: parts.right, opacity: 0.62 });
      faces.push({ pts: parts.left, opacity: 0.4 });
    }
  }
  const map = frame(faces.flatMap((face) => face.pts));
  return faces
    .map((face) => {
      const pts = face.pts.map(map);
      if (face.wire) return stroke(poly(pts), 1);
      return fill(poly(pts), face.opacity);
    })
    .filter(Boolean);
}

export function driven(values, rest, max, x, y) {
  const wave = values.wave;
  if (typeof wave !== "function") return rest;
  return rest + (max - rest) * (wave.gain ?? 1) * wave(x, y);
}

export function sheet() {
  return "0 0 1000 1000";
}

export function pattern(spec) {
  return spec;
}
