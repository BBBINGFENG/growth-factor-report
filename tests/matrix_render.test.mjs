// Real SVG rendering of the matrix option with a synthetic matrix (missing, true 0, positive, negative).
// Test data only; never written to public/data.  Run: node --test tests/
import assert from "node:assert/strict";
import test from "node:test";
import * as echarts from "echarts";
import { MISSING_FILL, MISSING_TEXT, matrixOption } from "../src/modules/factor_relationships/matrixOption.ts";

const labels = ["A", "B", "C", "D"];
const values = [
  [1, 0, 0.8, -0.8],
  [0, 1, null, 0.35],
  [0.8, null, 1, -0.5],
  [-0.8, 0.35, -0.5, null],
];
const nMissing = values.flat().filter((v) => v === null).length;

function render() {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 520, height: 460 });
  chart.setOption(matrixOption(labels, values, (i, j) => [`detail ${i},${j}`]));
  return chart;
}

const texts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

test("missing cells are drawn grey with a dash; true 0 is drawn as 0.00", () => {
  const chart = render();
  const svg = chart.renderToSVGString();
  const t = texts(svg);
  assert.equal(t.filter((x) => x === MISSING_TEXT).length, nMissing);
  assert.equal(t.filter((x) => x === "0.00").length, 2);
  assert.equal((svg.match(new RegExp(`fill="${MISSING_FILL}"`, "g")) || []).length, nMissing);
  assert.ok(t.includes("0.80") && t.includes("-0.80") && t.includes("-0.50") && t.includes("0.35"));
  chart.dispose();
});

test("colour scale is fixed to -1..1: positive red, negative blue, zero near white; missing not coloured by the scale", () => {
  const chart = render();
  const opt = chart.getOption();
  assert.equal(opt.visualMap[0].min, -1);
  assert.equal(opt.visualMap[0].max, 1);
  const data = chart.getModel().getSeriesByIndex(0).getData();
  const fill = {};
  for (let k = 0; k < data.count(); k++) {
    const [j, i, v] = [data.get("x", k), data.get("y", k), data.get(data.mapDimension("value"), k)];
    fill[`${i},${j}`] = { v, c: data.getItemVisual(k, "style").fill };
  }
  const rgb = (c) => echarts.color.parse(c);
  const pos = rgb(fill["0,2"].c), neg = rgb(fill["0,3"].c), zero = rgb(fill["0,1"].c);
  assert.ok(pos[0] > pos[2] + 40, `positive should be red: ${fill["0,2"].c}`);
  assert.ok(neg[2] > neg[0] + 40, `negative should be blue: ${fill["0,3"].c}`);
  assert.ok(Math.min(...zero.slice(0, 3)) > 230, `zero should be near white: ${fill["0,1"].c}`);
  assert.equal(fill["1,2"], undefined);       // missing cells are not in the heatmap at all
  assert.equal(fill["3,3"], undefined);
  assert.equal(data.count(), 16 - nMissing);
  chart.dispose();
});

test("tooltip says missing and keeps the sample detail", () => {
  const opt = matrixOption(labels, values, (i, j) => [`有效月份 ${i}${j}`]);
  const miss = opt.tooltip.formatter({ seriesIndex: 1, data: [2, 1] });
  assert.match(miss, /B × C：缺失/);
  assert.match(miss, /有效月份 12/);
  const zero = opt.tooltip.formatter({ seriesIndex: 0, data: [1, 0, 0] });
  assert.match(zero, /A × B：0\.000/);
});
