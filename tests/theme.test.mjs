import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../app/litric.css", import.meta.url), "utf8");
const design = css.slice(css.indexOf("/* LITRIC V1 purple"));
const palette = {};
for (const [, key, hex] of design
  .split(':root[data-theme="dark"]')[0]
  .matchAll(/--([\w-]+):\s*(#[\da-f]{6})\b/gi))
  palette[key] = hex;
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("purple theme: normal text meets WCAG AA on both gradient endpoints", () => {
  for (const color of [
    "purple",
    "violet",
    "rose",
    "rose-end",
    "green-readable",
    "green-end",
    "card-purple",
    "purple-end",
  ]) {
    assert.ok(contrast(palette["on-color"], palette[color]) >= 4.5, color);
  }
  for (const color of ["amber", "amber-end"])
    assert.ok(contrast(palette["on-amber"], palette[color]) >= 4.5, color);
});
test("purple theme: light, dark and high contrast body text meets WCAG AA", () => {
  const variants = [...design.matchAll(/(:root[^{}]*)\{([^}]+)\}/g)].slice(
    0,
    4,
  );
  const read = (body) =>
    Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\b/gi)].map((m) => [
        m[1],
        m[2],
      ]),
    );
  const base = read(variants[0][2]);
  const dark = read(variants[1][2]);
  for (const [, selector, body] of variants) {
    const tokens = {
      ...base,
      ...(selector.includes("dark") ? dark : {}),
      ...read(body),
    };
    for (const fg of ["text", "muted"])
      for (const bg of ["bg", "surface", "surface2"]) {
        assert.ok(
          contrast(tokens[fg], tokens[bg]) >= 4.5,
          `${selector}: ${fg} on ${bg}`,
        );
      }
  }
});
