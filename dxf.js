(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.DxfAnalyzer = api;
})(globalThis, function () {
  "use strict";

  const MAX_ENTITIES = 100000;
  const KNOWN_SECTIONS = new Set(["HEADER", "CLASSES", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS", "THUMBNAILIMAGE", "ACDSDATA"]);
  const SEMANTIC_LAYERS = {
    "AA-DWXM-DOOR": {
      key: "door",
      label: "문·문틀",
      description: "문 블록과 문짝 선",
      semanticColor: "#4268e8"
    },
    "AA-WAXM-CONC": {
      key: "concrete-wall",
      label: "콘크리트 벽체",
      description: "콘크리트 벽체 선 요소",
      semanticColor: "#d36a43"
    },
    "AA-WAXS-FIN1": {
      key: "finish",
      label: "마감재",
      description: "바닥·벽 마감 선 요소",
      semanticColor: "#23876b"
    },
    PBTEX: {
      key: "column",
      label: "기둥",
      description: "기둥 외곽 선",
      semanticColor: "#8556bc"
    },
    "AA-XXXX-OPEN": {
      key: "opening",
      label: "개구부·문 여닫이선",
      description: "레이어명과 블록 내 선 형상으로 추정",
      semanticColor: "#d38529"
    }
  };

  function classifyLayer(name) {
    const semantic = SEMANTIC_LAYERS[String(name || "").toUpperCase()];
    return semantic || {
      key: "other",
      label: "미분류",
      description: "확인된 도면 의미 없음",
      semanticColor: "#738096"
    };
  }

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

  function transformGeometry(geometry, block, insert) {
    const scaleX = firstValue(insert, 41) ?? 1;
    const scaleY = firstValue(insert, 42) ?? 1;
    const angle = (firstValue(insert, 50) || 0) * (Math.PI / 180);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const offsetX = firstValue(insert, 10) ?? 0;
    const offsetY = firstValue(insert, 20) ?? 0;

    function transformPoint(point) {
      const x = (point[0] - block.base[0]) * scaleX;
      const y = (point[1] - block.base[1]) * scaleY;
      return [offsetX + x * cosine - y * sine, offsetY + x * sine + y * cosine];
    }

    if (geometry.type === "circle" && Math.abs(Math.abs(scaleX) - Math.abs(scaleY)) < 1e-8) {
      return {
        type: "circle",
        center: transformPoint(geometry.center),
        radius: geometry.radius * Math.abs(scaleX)
      };
    }

    const points = geometry.type === "circle"
      ? Array.from({ length: 49 }, (_, index) => {
        const angle = (index / 48) * Math.PI * 2;
        return [
          geometry.center[0] + geometry.radius * Math.cos(angle),
          geometry.center[1] + geometry.radius * Math.sin(angle)
        ];
      })
      : geometry.points;
    const transformedPoints = points.map(transformPoint);
    if (geometry.type === "line") return { type: "line", points: transformedPoints };
    return {
      type: "polyline",
      points: transformedPoints,
      closed: geometry.type === "circle" || (geometry.type === "polyline" && geometry.closed)
    };
  }

  function geometryBounds(primitives) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    function include(x, y) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    for (const primitive of primitives) {
      if (primitive.type === "circle") {
        const [x, y] = primitive.center;
        include(x - primitive.radius, y - primitive.radius);
        include(x + primitive.radius, y + primitive.radius);
      } else {
        for (const [x, y] of primitive.points) include(x, y);
      }
    }

    return Number.isFinite(minX)
      ? { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
      : null;
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
    const blocks = new Map();
    let section = null;
    let activeBlock = null;
    let unitsCode = null;
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
        activeBlock = null;
        continue;
      }
      if (section === "HEADER" && pair.code === 9 && pair.value === "$INSUNITS") {
        unitsCode = numeric(pairs[i + 1]?.value);
        continue;
      }
      if (pair.code !== 0 || !section) continue;

      const record = [];
      for (let j = i + 1; j < pairs.length && pairs[j].code !== 0; j += 1) {
        record.push(pairs[j]);
      }

      if (section === "BLOCKS" && pair.value === "BLOCK") {
        const name = record.find((item) => item.code === 2)?.value;
        if (name) {
          activeBlock = {
            name,
            base: [firstValue(record, 10) ?? 0, firstValue(record, 20) ?? 0],
            primitives: []
          };
          blocks.set(name, activeBlock);
        }
      } else if (section === "BLOCKS" && pair.value === "ENDBLK") {
        activeBlock = null;
      } else if (section === "BLOCKS" && activeBlock) {
        const geometry = entityGeometry(pair.value.toUpperCase(), record);
        if (geometry) {
          activeBlock.primitives.push({
            geometry,
            layer: record.find((item) => item.code === 8)?.value || "0"
          });
        }
      }

      if (section === "TABLES" && pair.value === "LAYER") {
        const name = record.find((item) => item.code === 2)?.value;
        if (name) {
          const semantic = classifyLayer(name);
          layers.set(name, {
            name,
            color: firstValue(record, 62),
            flags: firstValue(record, 70) || 0,
            count: layers.get(name)?.count || 0,
            entityCounts: layers.get(name)?.entityCounts || {},
            ...semantic
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
        const layerInfo = layers.get(layer) || {
          name: layer,
          color: null,
          flags: 0,
          count: 0,
          entityCounts: {},
          ...classifyLayer(layer)
        };
        layerInfo.count += 1;
        layerInfo.entityCounts[type] = (layerInfo.entityCounts[type] || 0) + 1;
        layers.set(layer, layerInfo);

        const geometry = entityGeometry(type, record);
        if (geometry) primitives.push({ ...geometry, layer });
        if (type === "INSERT") {
          const block = blocks.get(record.find((item) => item.code === 2)?.value);
          if (block) {
            for (const member of block.primitives) {
              const transformed = transformGeometry(member.geometry, block, record);
              primitives.push({
                ...transformed,
                layer: member.layer === "0" ? layer : member.layer
              });
            }
          }
        }
      }
    }

    if (!sawSection) throw new Error("DXF 섹션을 찾지 못했습니다. 텍스트 DXF 파일인지 확인해 주세요.");
    return {
      layers: [...layers.values()].sort((a, b) => a.name.localeCompare(b.name)),
      entityCounts: [...entityCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      entityCount,
      unitsCode,
      bounds: geometryBounds(primitives),
      primitives
    };
  }

  return { parseDxf, classifyLayer };
});
