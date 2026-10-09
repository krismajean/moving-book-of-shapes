import { createSound } from "./audio.js";
import { createRadiate } from "./lib/radiate.js";
import { patternById, patterns } from "./patterns/catalog.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const sound = createSound();
const radiate = createRadiate();
const gallery = document.querySelector("#gallery");
const studio = document.querySelector("#studio");
const stage = document.querySelector("#stage");
const panel = document.querySelector("#panel");
const tagsNav = document.querySelector("#tags");
const lede = document.querySelector("#lede");
const crumbTail = document.querySelector("#crumb-tail");
const crumbTag = document.querySelector("#crumb-tag");
const crumbName = document.querySelector("#crumb-name");
const pager = document.querySelector("#pager");
const prevLink = document.querySelector("#prev-link");
const nextLink = document.querySelector("#next-link");
const fullButton = document.querySelector("#full");
const marksGroup = document.createElementNS(SVG_NS, "g");
stage.appendChild(marksGroup);

const amount = { value: 0.7 };
const response = { value: 0.45 };
const envelope = { level: 0, low: 0, mid: 0, high: 0 };
let audioOn = false;
let tag = "all";
let current = null;
let values = {};
let maps = {};
const rest = {};
let statusEl;
let meterEl;

function patternTags(item) {
  const tags = [...(item.tags || [])];
  if (item.radiate) tags.push("audio");
  return tags;
}

function defaults(pattern) {
  return Object.fromEntries(pattern.params.map((param) => [param.key, param.value]));
}

function marksOf(drawn) {
  if (drawn.marks) return drawn.marks.filter(Boolean);
  return (drawn.paths || []).map((d) => ({ d, fill: "none", stroke: "currentColor", sw: 1.15 }));
}

function paintSvg(svg, group, drawn) {
  svg.setAttribute("viewBox", drawn.viewBox || "0 0 1000 1000");
  const marks = marksOf(drawn);
  while (group.childNodes.length > marks.length) group.lastChild.remove();
  for (let i = 0; i < marks.length; i += 1) {
    let path = group.childNodes[i];
    if (!path) {
      path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("vector-effect", "non-scaling-stroke");
      group.appendChild(path);
    }
    const mark = marks[i];
    path.setAttribute("d", mark.d);
    path.setAttribute("fill", mark.fill || "none");
    path.setAttribute("stroke", mark.stroke || "none");
    path.setAttribute("stroke-width", String(mark.sw ?? 1.15));
    path.setAttribute("fill-opacity", String(mark.opacity ?? 1));
  }
}

function renderValues() {
  if (!current || !current.radiate || !radiate.state.on || !audioOn) return values;
  const wave = (x, y) => radiate.sample(x, y, performance.now());
  wave.gain = amount.value;
  return { ...values, wave };
}

function paint() {
  if (!current) return;
  paintSvg(stage, marksGroup, current.render(renderValues()));
}

function decimals(step) {
  if (step >= 1) return 0;
  return Math.min(4, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

function formatValue(param, value) {
  return Number(value).toFixed(decimals(param.step));
}

function quantize(param, value) {
  const steps = Math.round((value - param.min) / param.step);
  const clamped = Math.min(param.max, Math.max(param.min, param.min + steps * param.step));
  return Number(clamped.toFixed(decimals(param.step)));
}

function sliderField(label, state, min, max, step) {
  const wrap = document.createElement("label");
  wrap.className = "control";
  const nameEl = document.createElement("span");
  nameEl.textContent = label;
  const output = document.createElement("output");
  output.textContent = Number(state.value).toFixed(2);
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(state.value);
  input.addEventListener("input", () => {
    state.value = Number(input.value);
    output.textContent = state.value.toFixed(2);
  });
  wrap.append(nameEl, output, input);
  return wrap;
}

function stopAudio() {
  sound.stop();
  audioOn = false;
  radiate.clear();
}

function neighbors(pattern) {
  const index = patterns.indexOf(pattern);
  return {
    prev: patterns[(index - 1 + patterns.length) % patterns.length],
    next: patterns[(index + 1) % patterns.length],
  };
}

function setChrome(pattern) {
  const onPattern = Boolean(pattern);
  crumbTail.hidden = !onPattern;
  pager.hidden = !onPattern;
  lede.hidden = onPattern;
  tagsNav.hidden = onPattern;
  if (!onPattern) return;
  const { prev, next } = neighbors(pattern);
  const tagName = patternTags(pattern)[0] || "all";
  crumbTag.textContent = tagName;
  crumbTag.onclick = () => {
    tag = tagName;
  };
  crumbName.textContent = pattern.name;
  prevLink.href = `#/${prev.id}`;
  prevLink.textContent = "Previous";
  nextLink.href = `#/${next.id}`;
  nextLink.textContent = `Next: ${next.name}`;
}

async function setFull(on) {
  document.body.classList.toggle("is-full", on);
  fullButton.textContent = on ? "Exit" : "Full screen";
  fullButton.setAttribute("aria-pressed", on ? "true" : "false");
  if (on && !document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); } catch { /* the layout still fills the window */ }
  }
  if (!on && document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch { /* already left */ }
  }
}

function buildPanel() {
  panel.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = current.name;
  const note = document.createElement("p");
  note.textContent = current.note;
  if (current.study) note.className = "study";
  panel.append(title, note);

  for (const param of current.params) {
    if (param.type === "text") {
      const label = document.createElement("label");
      label.className = "control";
      const nameEl = document.createElement("span");
      nameEl.textContent = param.label;
      const input = document.createElement("input");
      input.type = "text";
      input.value = String(values[param.key] ?? "");
      input.maxLength = 16;
      input.dataset.key = param.key;
      input.setAttribute("aria-label", param.label);
      input.addEventListener("input", () => {
        values[param.key] = input.value;
        paint();
      });
      label.append(nameEl, input);
      panel.append(label);
      continue;
    }
    const label = document.createElement("label");
    label.className = "control";
    const nameEl = document.createElement("span");
    nameEl.textContent = param.label;
    const output = document.createElement("output");
    output.textContent = formatValue(param, values[param.key]);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(param.min);
    input.max = String(param.max);
    input.step = String(param.step);
    input.value = String(values[param.key]);
    input.dataset.key = param.key;
    input.addEventListener("input", () => {
      values[param.key] = quantize(param, Number(input.value));
      output.textContent = formatValue(param, values[param.key]);
      if (!audioOn || maps[param.key] === "off") paint();
    });
    label.append(nameEl, output, input);
    panel.append(label);
  }

  const soundHeading = document.createElement("h2");
  soundHeading.textContent = "Sound";
  const soundNote = document.createElement("p");
  soundNote.textContent = "Sound pushes a linked slider from where it sits toward its max. Whole-number sliders jump, so they start off.";
  panel.append(soundHeading, soundNote);

  const buttons = document.createElement("div");
  buttons.className = "row";
  const mic = document.createElement("button");
  mic.type = "button";
  mic.textContent = "Microphone";
  const preview = document.createElement("button");
  preview.type = "button";
  preview.textContent = "Preview tone";
  const stop = document.createElement("button");
  stop.type = "button";
  stop.textContent = "Stop";
  const fileLabel = document.createElement("label");
  fileLabel.className = "row";
  const fileName = document.createElement("span");
  fileName.textContent = "Audio file";
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "audio/*";
  fileInput.setAttribute("aria-label", "Audio file");
  fileLabel.append(fileName, fileInput);

  function mark(active) {
    mic.setAttribute("aria-pressed", active === "mic" ? "true" : "false");
    preview.setAttribute("aria-pressed", active === "preview" ? "true" : "false");
  }
  async function arm(kind, start) {
    try {
      await start();
      for (const param of current.params) rest[param.key] = values[param.key];
      envelope.level = 0;
      envelope.low = 0;
      envelope.mid = 0;
      envelope.high = 0;
      audioOn = true;
      mark(kind);
      statusEl.textContent = kind === "mic" ? "Listening." : kind === "file" ? "Playing the file." : "Preview tone.";
    } catch (error) {
      audioOn = false;
      mark("off");
      statusEl.textContent = error && error.message ? error.message : "Could not start audio.";
    }
  }
  mic.addEventListener("click", () => arm("mic", () => sound.startMic()));
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) arm("file", () => sound.startFile(file));
  });
  preview.addEventListener("click", () => arm("preview", () => sound.startPreview()));
  stop.addEventListener("click", () => {
    stopAudio();
    mark("off");
    statusEl.textContent = "Stopped.";
  });
  buttons.append(mic, preview, stop);
  panel.append(buttons, fileLabel, sliderField("Amount", amount, 0, 1, 0.01), sliderField("Response", response, 0.05, 0.9, 0.01));

  if (current.radiate) {
    const radiateHeading = document.createElement("h2");
    radiateHeading.textContent = "Radiate";
    const radiateNote = document.createElement("p");
    radiateNote.textContent = "Sound leaves an origin and reaches the rest of the sheet late. Spread is how long that crossing takes. Ring is how thick that band is. The slider stays the rest pose. Amount is how far the ring travels.";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = "Radiate";
    toggle.setAttribute("aria-pressed", radiate.state.on ? "true" : "false");
    toggle.addEventListener("click", () => {
      radiate.state.on = !radiate.state.on;
      if (!radiate.state.on) radiate.clear();
      toggle.setAttribute("aria-pressed", radiate.state.on ? "true" : "false");
      paint();
    });
    const originRow = document.createElement("label");
    originRow.className = "map";
    const originName = document.createElement("span");
    originName.textContent = "Origin";
    const originSelect = document.createElement("select");
    for (const [value, label] of [["center", "Center"], ["left", "Left"], ["right", "Right"], ["top", "Top"], ["bottom", "Bottom"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (radiate.state.origin === value) option.selected = true;
      originSelect.append(option);
    }
    originSelect.addEventListener("change", () => {
      radiate.state.origin = originSelect.value;
    });
    originRow.append(originName, originSelect);
    const bandRow = document.createElement("label");
    bandRow.className = "map";
    const bandName = document.createElement("span");
    bandName.textContent = "Band";
    const bandSelect = document.createElement("select");
    for (const [value, label] of [["level", "Level, loudness"], ["low", "Low, bass"], ["mid", "Mid, middle"], ["high", "High, top"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (radiate.state.band === value) option.selected = true;
      bandSelect.append(option);
    }
    bandSelect.addEventListener("change", () => {
      radiate.state.band = bandSelect.value;
    });
    bandRow.append(bandName, bandSelect);
    const spread = { get value() { return radiate.state.spread; }, set value(n) { radiate.state.spread = n; } };
    const width = { get value() { return radiate.state.width; }, set value(n) { radiate.state.width = n; } };
    panel.append(
      radiateHeading,
      radiateNote,
      toggle,
      originRow,
      bandRow,
      sliderField("Spread", spread, 0.2, 3, 0.1),
      sliderField("Ring", width, 0.08, 1, 0.01),
    );
  }

  const mapHeading = document.createElement("h2");
  mapHeading.textContent = "Links";
  const mapNote = document.createElement("p");
  mapNote.textContent = "A link follows one part of the sound. Level is how loud it is overall. Low is the bass. Mid is the middle, where voices sit. High is the bright top. Amount is how far every linked slider travels, and Response is how fast it follows. The preview tone rests quiet, then swells. Bass is the slow one.";
  meterEl = document.createElement("div");
  meterEl.className = "bands";
  for (const [key, name, hint] of [
    ["level", "Level", "loudness"],
    ["low", "Low", "bass"],
    ["mid", "Mid", "middle"],
    ["high", "High", "top"],
  ]) {
    const row = document.createElement("div");
    row.className = "band";
    const nameEl = document.createElement("span");
    nameEl.textContent = name;
    const hintEl = document.createElement("small");
    hintEl.textContent = hint;
    nameEl.append(hintEl);
    const meter = document.createElement("div");
    meter.className = "meter";
    const bar = document.createElement("span");
    bar.dataset.band = key;
    meter.append(bar);
    row.append(nameEl, meter);
    meterEl.append(row);
  }
  panel.append(mapHeading, mapNote, meterEl);
  for (const param of current.params) {
    if (param.type === "text") continue;
    const row = document.createElement("label");
    row.className = "map";
    const span = document.createElement("span");
    span.textContent = param.label;
    const select = document.createElement("select");
    for (const [value, label] of [
      ["off", "Off"],
      ["level", "Level, loudness"],
      ["low", "Low, bass"],
      ["mid", "Mid, middle"],
      ["high", "High, top"],
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if (maps[param.key] === value) option.selected = true;
      select.append(option);
    }
    select.addEventListener("change", () => {
      maps[param.key] = select.value;
      if (audioOn) rest[param.key] = values[param.key];
    });
    row.append(span, select);
    panel.append(row);
  }
  statusEl = document.createElement("p");
  statusEl.id = "status";
  panel.append(statusEl);
}

function syncControl(key) {
  const input = panel.querySelector(`input[data-key="${key}"]`);
  if (!input || !current) return;
  const param = current.params.find((item) => item.key === key);
  input.value = String(values[key]);
  const output = input.parentElement.querySelector("output");
  if (output && param) output.textContent = formatValue(param, values[key]);
}

function showGallery() {
  stopAudio();
  if (document.body.classList.contains("is-full")) setFull(false);
  current = null;
  studio.hidden = true;
  gallery.hidden = false;
  setChrome(null);
  document.title = "Pattern bench";
  const counts = new Map();
  for (const item of patterns) {
    for (const name of patternTags(item)) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = ["all", ...[...counts.keys()].sort()];
  tagsNav.replaceChildren();
  for (const name of names) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name === "all" ? `All ${patterns.length}` : `${name} ${counts.get(name)}`;
    button.setAttribute("aria-pressed", name === tag ? "true" : "false");
    button.addEventListener("click", () => {
      tag = name;
      showGallery();
    });
    tagsNav.append(button);
  }
  lede.textContent = "Local drawings from the public ideas. Their code and node graphs are not used.";
  gallery.replaceChildren();
  for (const item of patterns) {
    if (tag !== "all" && !patternTags(item).includes(tag)) continue;
    const card = document.createElement("a");
    card.className = "card";
    card.href = `#/${item.id}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    const group = document.createElementNS(SVG_NS, "g");
    svg.append(group);
    paintSvg(svg, group, item.render(defaults(item)));
    const label = document.createElement("span");
    label.textContent = item.name;
    card.append(svg, label);
    gallery.append(card);
  }
}

function showPattern(id) {
  const pattern = patternById(id);
  if (!pattern) {
    location.hash = "#/";
    return;
  }
  stopAudio();
  current = pattern;
  values = defaults(pattern);
  maps = Object.fromEntries(pattern.params.map((param) => [param.key, param.step < 1 ? "level" : "off"]));
  gallery.hidden = true;
  studio.hidden = false;
  stage.setAttribute("aria-label", pattern.name);
  document.title = `${pattern.name} - Pattern bench`;
  setChrome(pattern);
  buildPanel();
  paint();
}

function route() {
  const id = location.hash.replace(/^#\/?/, "");
  if (!id) showGallery();
  else showPattern(id);
}

function frame() {
  requestAnimationFrame(frame);
  if (!audioOn || !current || !meterEl) return;
  const levels = sound.levels();
  if (!levels) return;
  const follow = response.value;
  let moved = false;
  for (const key of Object.keys(envelope)) {
    const next = levels[key];
    const rate = next > envelope[key] ? follow : follow * 0.35;
    envelope[key] += (next - envelope[key]) * rate;
  }
  for (const bar of meterEl.querySelectorAll("[data-band]")) {
    bar.style.width = `${Math.round((envelope[bar.dataset.band] || 0) * 100)}%`;
  }
  if (current.radiate && radiate.state.on) {
    radiate.push(envelope[radiate.state.band] ?? 0, performance.now());
    moved = true;
  }
  for (const param of current.params) {
    const source = maps[param.key];
    if (param.type === "text" || !source || source === "off") continue;
    if (current.radiate && radiate.state.on && param.key === current.radiate) continue;
    const level = envelope[source] ?? 0;
    const from = rest[param.key] ?? values[param.key];
    const next = quantize(param, from + (param.max - from) * amount.value * level);
    if (next !== values[param.key]) {
      values[param.key] = next;
      syncControl(param.key);
      moved = true;
    }
  }
  if (moved) paint();
}

fullButton.addEventListener("click", () => setFull(!document.body.classList.contains("is-full")));
document.addEventListener("fullscreenchange", () => {
  const on = Boolean(document.fullscreenElement);
  document.body.classList.toggle("is-full", on);
  fullButton.textContent = on ? "Exit" : "Full screen";
  fullButton.setAttribute("aria-pressed", on ? "true" : "false");
});
window.addEventListener("keydown", (event) => {
  if (!current) return;
  if (event.target.closest("input, select, textarea")) return;
  if (event.key === "ArrowRight") location.hash = `#/${neighbors(current).next.id}`;
  if (event.key === "ArrowLeft") location.hash = `#/${neighbors(current).prev.id}`;
});

window.addEventListener("hashchange", route);
route();
requestAnimationFrame(frame);
