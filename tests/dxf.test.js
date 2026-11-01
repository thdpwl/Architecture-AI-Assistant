const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDxf } = require("../dxf.js");

function dxf(pairs) {
  return pairs.map(([code, value]) => `${code}\n${value}\n`).join("");
}

test("reads layer definitions and counts supported and unsupported entities", () => {
  const source = dxf([
    [0, "SECTION"], [2, "TABLES"], [0, "TABLE"], [2, "LAYER"],
    [0, "LAYER"], [2, "A-WALL"], [70, "0"], [62, "7"],
    [0, "LAYER"], [2, "A-DOOR"], [70, "0"], [62, "2"],
    [0, "ENDTAB"], [0, "ENDSEC"],
    [0, "SECTION"], [2, "ENTITIES"],
    [0, "LINE"], [8, "A-WALL"], [10, "0"], [20, "0"], [11, "100"], [21, "50"],
    [0, "LWPOLYLINE"], [8, "A-WALL"], [70, "1"],
    [10, "0"], [20, "0"], [10, "50"], [20, "0"], [10, "50"], [20, "25"],
    [0, "CIRCLE"], [8, "A-DOOR"], [10, "20"], [20, "30"], [40, "5"],
    [0, "ARC"], [8, "A-DOOR"], [10, "20"], [20, "30"], [40, "5"], [50, "0"], [51, "90"],
    [0, "TEXT"], [8, "A-DOOR"], [1, "<script>alert(1)</script>"],
    [0, "ENDSEC"], [0, "EOF"]
  ]);

  const result = parseDxf(source);
  assert.equal(result.entityCount, 5);
  assert.deepEqual(result.entityCounts, [["ARC", 1], ["CIRCLE", 1], ["LINE", 1], ["LWPOLYLINE", 1], ["TEXT", 1]]);
  assert.deepEqual(result.layers.map(({ name, count }) => [name, count]), [["A-DOOR", 3], ["A-WALL", 2]]);
  assert.equal(result.layers[0].color, 2);
  assert.deepEqual(result.primitives.map(({ type }) => type), ["line", "polyline", "circle", "arc"]);
  assert.equal(result.primitives[1].closed, true);
  assert.equal(result.primitives[2].radius, 5);
});

test("counts entities on undeclared default layers and safely reports no preview geometry", () => {
  const result = parseDxf(dxf([
    [0, "SECTION"], [2, "ENTITIES"], [0, "TEXT"], [1, "label"], [0, "ENDSEC"], [0, "EOF"]
  ]));
  assert.equal(result.entityCount, 1);
  assert.deepEqual(result.layers.map(({ name, count }) => [name, count]), [["0", 1]]);
  assert.deepEqual(result.primitives, []);
});

test("rejects malformed, empty, binary, and sectionless DXF input", () => {
  assert.throws(() => parseDxf(""), /비어 있습니다/);
  assert.throws(() => parseDxf("AutoCAD Binary DXF"), /바이너리/);
  assert.throws(() => parseDxf("SECTION\n"), /그룹 코드/);
  assert.throws(() => parseDxf("0\nEOF\n"), /섹션/);
});
