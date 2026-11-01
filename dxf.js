(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DxfAnalyzer = api;
})(globalThis, function () {
  "use strict";

  const MAX_ENTITIES = 100000;
  const KNOWN_SECTIONS = new Set(["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS", "THUMBNAILIMAGE", "ACDSDATA"]);

  function parsePairs(text) {
    const lines = text.replace(/^\uFEFF/, "").replace(/\s+$/, "").split(/\r\n|\n|\r/);
    if (lines.length < 2 || lines.length % 2 !== 0) {
      throw new Error("DXF 그룹 코드 데이터가 올바르지 않습니다.");
    }

    const pairs = [];
    for (let i = 0; i < lines.length; i += 2) {
      const codeText = lines[i].trim();
      if (!/^-?\d+$/.test(codeText)) {
        throw new Error(`DXF ${i + 1}번째 줄의 그룹 코드가 올바르지 않습니다.`);
      }
      pairs.push({ code: Number(codeText), value: lines[i + 1].trim() });
    }
    return pairs;
  }

  function numeric(value) {
    if (value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function firstValue(pairs, code) {
    return numeric(pairs.find((pair) => pair.code === code)?.value);
  }

  function pointPairs(pairs) {
    const points = [];
    let x = null;
    for (const pair of pairs) {
      if (pair.code === 10) x = numeric(pair.value);
      if (pair.code === 20 && x !== null) {
        const y = numeric(pair.value);
        if (y !== null) points.push([x, y]);
        x = null;
      }
    }
    return points;
  }

  function entityGeometry(type, pairs) {
    if (type === "LINE") {
      const x1 = firstValue(pairs, 10);
      const y1 = firstValue(pairs, 20);
      const x2 = firstValue(pairs, 11);
      const y2 = firstValue(pairs, 21);
      return [x1, y1, x2, y2].every((value) => value !== null)
        ? { type: "line", points: [[x1, y1], [x2, y2]] }
        : null;
    }

    if (type === "LWPOLYLINE") {
      const points = pointPairs(pairs);
      return points.length > 1
        ? { type: "polyline", points, closed: ((firstValue(pairs, 70) || 0) & 1) === 1 }
        : null;
    }

    if (type === "CIRCLE") {
      const x = firstValue(pairs, 10);
      const y = firstValue(pairs, 20);
      const radius = firstValue(pairs, 40);
      return x !== null && y !== null && radius > 0
        ? { type: "circle", center: [x, y], radius }
        : null;
    }

    if (type === "ARC") {
      const x = firstValue(pairs, 10);
      const y = firstValue(pairs, 20);
      const radius = firstValue(pairs, 40);
      const start = firstValue(pairs, 50);
      const end = firstValue(pairs, 51);
      if (x === null || y === null || radius <= 0 || start === null || end === null) return null;
      let sweep = (end - start + 360) % 360;
      if (sweep === 0) sweep = 360;
      const segments = Math.max(4, Math.ceil(sweep / 10));
      const points = [];
      for (let i = 0; i <= segments; i += 1) {
        const angle = (start + (sweep * i) / segments) * (Math.PI / 180);
        points.push([x + radius * Math.cos(angle), y + radius * Math.sin(angle)]);
      }
      return { type: "arc", points };
    }

    return null;
  }

  function parseDxf(text) {
    if (typeof text !== "string" || !text.trim()) throw new Error("DXF 파일이 비어 있습니다.");
    if (text.startsWith("AutoCAD Binary DXF")) {
      throw new Error("바이너리 DXF는 지원하지 않습니다. 텍스트 DXF로 저장해 주세요.");
    }

    const pairs = parsePairs(text);
    const layers = new Map();
    const entityCounts = new Map();
    const primitives = [];
    let section = null;
    let entityCount = 0;
    let sawSection = false;

    for (let i = 0; i < pairs.length; i += 1) {
      const pair = pairs[i];
      if (pair.code === 0 && pair.value === "SECTION") {
        const name = pairs[i + 1];
        const sectionName = name?.code === 2 ? name.value.toUpperCase() : null;
        section = KNOWN_SECTIONS.has(sectionName) ? sectionName : null;
        if (section) sawSection = true;
        i += name?.code === 2 ? 1 : 0;
        continue;
      }
      if (pair.code === 0 && pair.value === "ENDSEC") {
        section = null;
        continue;
      }
      if (pair.code !== 0 || !section) continue;

      const record = [];
      for (let j = i + 1; j < pairs.length && pairs[j].code !== 0; j += 1) {
        record.push(pairs[j]);
      }

      if (section === "TABLES" && pair.value === "LAYER") {
        const name = record.find((item) => item.code === 2)?.value;
        if (name) {
          layers.set(name, {
            name,
            color: firstValue(record, 62),
            flags: firstValue(record, 70) || 0,
            count: layers.get(name)?.count || 0
          });
        }
      }

      if (section === "ENTITIES") {
        entityCount += 1;
        if (entityCount > MAX_ENTITIES) {
          throw new Error(`객체가 ${MAX_ENTITIES.toLocaleString()}개를 초과해 분석을 중단했습니다.`);
        }
        const layer = record.find((item) => item.code === 8)?.value || "0";
        const type = pair.value.toUpperCase();
        entityCounts.set(type, (entityCounts.get(type) || 0) + 1);
        const layerInfo = layers.get(layer) || { name: layer, color: null, flags: 0, count: 0 };
        layerInfo.count += 1;
        layers.set(layer, layerInfo);

        const geometry = entityGeometry(type, record);
        if (geometry) primitives.push({ ...geometry, layer });
      }
    }

    if (!sawSection) throw new Error("DXF 섹션을 찾지 못했습니다. 텍스트 DXF 파일인지 확인해 주세요.");
    return {
      layers: [...layers.values()].sort((a, b) => a.name.localeCompare(b.name)),
      entityCounts: [...entityCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      entityCount,
      primitives
    };
  }

  return { parseDxf };
});
