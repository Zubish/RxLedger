import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import test from "node:test";

const require = createRequire(resolve("package.json"));
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const filename = resolve("src/components/DashboardInventorySnapshot.tsx");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const componentModule = new Module(filename);
componentModule.filename = filename;
componentModule.paths = Module._nodeModulePaths(resolve("src/components"));
componentModule._compile(compiled, filename);
const { DashboardInventorySnapshot } = componentModule.exports;

const render = (rows, branches = []) =>
  renderToStaticMarkup(
    React.createElement(DashboardInventorySnapshot, {
      rows,
      branches,
      formatMoney: (value) => `NGN ${value}`,
      onViewReports: () => {},
    }),
  );
const counts = (html) =>
  [...html.matchAll(/<dd>(\d+)<span> \((\d+)%\)<\/span><\/dd>/g)].map(
    (match) => [Number(match[1]), Number(match[2])],
  );

test("snapshot counts only positive batches and partitions their expiry states", () => {
  const rows = [
    { quantity: 10, status: "ok" },
    { quantity: 2, status: "ok" },
    { quantity: 1, status: "near-expiry" },
    { quantity: 4, status: "expired" },
    { quantity: 0, status: "expired" },
    { quantity: -1, status: "ok" },
  ];
  const before = structuredClone(rows);
  const html = render(rows);
  assert.match(html, /4 stocked batches in your dashboard scope/);
  assert.deepEqual(counts(html), [
    [2, 50],
    [1, 25],
    [1, 25],
  ]);
  assert.deepEqual(rows, before);
});

test("empty snapshot has explicit zero counts without invalid percentages", () => {
  const html = render([{ quantity: 0, status: "ok" }]);
  assert.deepEqual(counts(html), [
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  assert.match(html, /No stocked batches in this scope/);
  assert.match(html, /No active branches in this scope/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("branch bars use only supplied values and escape branch labels", () => {
  const branches = [
    { id: "a", name: "A & B", value: 100 },
    { id: "b", name: "Clinic", value: 25 },
  ];
  const html = render([], branches);
  assert.match(html, /A &amp; B/);
  assert.match(html, /NGN 100/);
  assert.match(html, /width:100%/);
  assert.match(html, /width:25%/);
  assert.match(render([], [{ id: "a", name: "Empty", value: 0 }]), /width:0%/);
});
