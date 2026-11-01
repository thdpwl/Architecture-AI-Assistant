const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
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

test("expands inserted blocks using base point, scale, and rotation", () => {
  const result = parseDxf(dxf([
    [0, "SECTION"], [2, "BLOCKS"],
    [0, "BLOCK"], [2, "DOOR"], [10, "10"], [20, "5"],
    [0, "LINE"], [8, "0"], [10, "10"], [20, "5"], [11, "20"], [21, "5"],
    [0, "CIRCLE"], [8, "A-DOOR"], [10, "10"], [20, "10"], [40, "2"],
    [0, "ENDBLK"], [0, "ENDSEC"],
    [0, "SECTION"], [2, "ENTITIES"],
    [0, "INSERT"], [8, "A-DOOR"], [2, "DOOR"], [10, "100"], [20, "200"], [41, "2"], [42, "2"], [50, "90"],
    [0, "ENDSEC"], [0, "EOF"]
  ]));

  assert.equal(result.entityCount, 1);
  assert.deepEqual(result.entityCounts, [["INSERT", 1]]);
  assert.equal(result.primitives.length, 2);
  assert.deepEqual(result.primitives[0], { type: "line", points: [[100, 200], [100, 220]], layer: "A-DOOR" });
  assert.deepEqual(result.primitives[1], { type: "circle", center: [90, 200], radius: 4, layer: "A-DOOR" });
});

test("reads the issue #3 commercial floorplan example without personal drawing metadata", () => {
  const drawing = fs.readFileSync("examples/issue-3-commercial-floorplan.dxf", "utf8");
  const result = parseDxf(drawing);

  assert.equal(result.unitsCode, 4);
  assert.equal(result.entityCount, 43);
  assert.deepEqual(result.entityCounts, [["INSERT", 2], ["LINE", 29], ["LWPOLYLINE", 12]]);
  assert.equal(result.layers.length, 6);
  assert.equal(result.primitives.length, 49);
  assert.ok(result.bounds.width > 25000);
  assert.ok(result.bounds.height > 5000);
  assert.doesNotMatch(drawing, /LASTSAVEDBY|LATITUDE|LONGITUDE|dpwl2/i);
});

test("rejects malformed, empty, binary, and sectionless DXF input", () => {
  assert.throws(() => parseDxf(""), /비어 있습니다/);
  assert.throws(() => parseDxf("AutoCAD Binary DXF"), /바이너리/);
  assert.throws(() => parseDxf("SECTION\n"), /그룹 코드/);
  assert.throws(() => parseDxf("0\nEOF\n"), /섹션/);
});
