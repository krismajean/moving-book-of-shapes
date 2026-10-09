import { bilinear, driven, ival, layout, meshLines, pattern, pointGrid, rng, sheet, val } from "../lib/geom.js";

export const wovenGrid = pattern({
  id: "woven-grid",
  name: "Woven grid",
  tags: ["distortion", "grid"],
  note: "A coarse grid is pushed out of shape. Each cell is then filled with straight lines between its four corners.",
  radiate: "displacement",
  params: [
    { key: "columns", label: "Columns", min: 2, max: 40, step: 1, value: 16 },
    { key: "rows", label: "Rows", min: 2, max: 40, step: 1, value: 16 },
    { key: "displacement", label: "Displacement", min: 0, max: 20, step: 0.1, value: 4.5 },
    { key: "steps", label: "Steps", min: 1, max: 16, step: 1, value: 6 },
    { key: "seed", label: "Seed", min: 0, max: 999, step: 1, value: 7 },
  ],
  render(values) {
    const columns = ival(values, "columns");
    const rows = ival(values, "rows");
    const steps = Math.max(1, ival(values, "steps"));
    const box = layout(columns, rows, 70);
    const coarse = pointGrid(columns, rows, (x, y) => {
      const px = box.ox + x * box.cell;
      const py = box.oy + y * box.cell;
      const disp = driven(values, val(values, "displacement"), 20, px, py);
      const jitter = (disp / 10) * box.cell * 0.55;
      const spin = rng(ival(values, "seed") + 1 + x * 1000 + y);
      return {
        x: px + (spin() * 2 - 1) * jitter,
        y: py + (spin() * 2 - 1) * jitter,
      };
    });
    const at = (gx, gy) => {
      const x0 = Math.min(columns - 1, Math.max(0, Math.floor(gx)));
      const y0 = Math.min(rows - 1, Math.max(0, Math.floor(gy)));
      return bilinear(
        coarse[y0][x0],
        coarse[y0][x0 + 1],
        coarse[y0 + 1][x0],
        coarse[y0 + 1][x0 + 1],
        gx >= columns ? 1 : gx - x0,
        gy >= rows ? 1 : gy - y0,
      );
    };
    const fine = pointGrid(columns * steps, rows * steps, (x, y) => at(x / steps, y / steps));
    return { viewBox: sheet(), marks: meshLines(fine) };
  },
});
