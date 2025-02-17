import React, { useRef, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Stage,
  Layer,
  Rect,
  Circle,
  Text,
  Star,
  RegularPolygon,
  Transformer,
} from "react-konva";
import "./styles.css";

const SHAPE_COUNT = 10000;
const STAGE_WIDTH = 10000;
const STAGE_HEIGHT = 10000;
const SCALE = 0.1;

// Optimization: Common property sets for reuse
const COMMON_PROPS = {
  shadowBlur: 5,
  opacity: 0.75,
};

const SHAPE_DEFAULTS = {
  rect: { width: 100, height: 100 },
  circle: { radius: 50 },
  text: { text: "★", fontSize: 100 },
  star: { numPoints: 5, innerRadius: 50, outerRadius: 100 },
  triangle: { sides: 3, radius: 100 },
  hexagon: { sides: 6, radius: 100 },
};

const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomColor = () => {
  const colors = ["#F00", "#0F0", "#00F", "#FF0", "#F0F", "#0FF"];
  return colors[Math.floor(Math.random() * colors.length)];
};

const Shape = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const Component = {
    rect: Rect,
    circle: Circle,
    text: Text,
    star: Star,
    triangle: RegularPolygon,
    hexagon: RegularPolygon,
  }[shapeProps.type];

  return (
    <>
      <Component
        {...shapeProps}
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: node.width() * scaleX,
            height: node.height() * scaleY,
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit resize
            const maxSize = Math.max(newBox.width, newBox.height);
            if (maxSize < 5) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

const generateShapes = () => {
  const shapes = [];
  const shapeTypes = ["rect", "circle", "text", "star", "triangle", "hexagon"];

  for (let i = 0; i < SHAPE_COUNT; i++) {
    const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    const x = getRandomInt(0, STAGE_WIDTH);
    const y = getRandomInt(0, STAGE_HEIGHT);
    const size = getRandomInt(50, 150);
    const rotation = getRandomInt(0, 360);
    const color = getRandomColor();

    const baseProps = {
      id: i.toString(),
      x,
      y,
      fill: color,
      rotation,
      type: shapeType,
      ...COMMON_PROPS,
    };

    const shapeDefaults = SHAPE_DEFAULTS[shapeType];
    const scaledDefaults = Object.entries(shapeDefaults).reduce(
      (acc, [key, value]) => {
        acc[key] = typeof value === "number" ? (value * size) / 100 : value;
        return acc;
      },
      {}
    );

    shapes.push({
      ...baseProps,
      ...scaledDefaults,
    });
  }
  return shapes;
};

const App = () => {
  const stageRef = useRef(null);
  const [fileSize, setFileSize] = useState(null);
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [lastExportMethod, setLastExportMethod] = useState("");

  useEffect(() => {
    setShapes(generateShapes());
    setIsLoading(false);
  }, []);

  const handleRegularExport = () => {
    const json = stageRef.current.toJSON();
    const blob = new Blob([json], { type: "application/json" });
    downloadAndShowSize(blob, "regular");
  };

  const handleMinifiedExport = () => {
    const json = stageRef.current.toJSON();
    const minified = JSON.stringify(JSON.parse(json));
    const blob = new Blob([minified], { type: "application/json" });
    downloadAndShowSize(blob, "minified");
  };

  const handleOptimizedExport = () => {
    // Convert shapes to a more efficient format
    const optimizedShapes = shapes.map(
      ({ id, x, y, fill, rotation, type }) => ({
        i: id,
        x,
        y,
        f: fill,
        r: rotation,
        t: type.charAt(0),
      })
    );

    const optimizedJson = JSON.stringify({
      v: 1, // version
      c: COMMON_PROPS,
      d: SHAPE_DEFAULTS,
      s: optimizedShapes,
    });

    const blob = new Blob([optimizedJson], { type: "application/json" });
    downloadAndShowSize(blob, "optimized");
  };

  const handleCompressedExport = () => {
    // Use delta compression for positions
    let lastX = 0,
      lastY = 0;
    const compressedShapes = shapes.map(
      ({ id, x, y, fill, rotation, type }) => {
        const deltaX = x - lastX;
        const deltaY = y - lastY;
        lastX = x;
        lastY = y;
        return {
          i: id,
          x: deltaX,
          y: deltaY,
          f: fill,
          r: rotation,
          t: type.charAt(0),
        };
      }
    );

    const compressedJson = JSON.stringify({
      v: 1,
      c: COMMON_PROPS,
      d: SHAPE_DEFAULTS,
      s: compressedShapes,
    });

    const blob = new Blob([compressedJson], { type: "application/json" });
    downloadAndShowSize(blob, "compressed");
  };

  const downloadAndShowSize = (blob, method) => {
    const size = blob.size;
    setFileSize(size);
    setLastExportMethod(method);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stage-${method}.json`;
    a.click();
  };

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedId(null);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const oldScale = stage.scaleX();

    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale = Math.max(
      0.05,
      Math.min(4, oldScale * (1 - e.evt.deltaY / 1000))
    );

    setStagePos({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  if (isLoading) {
    return (
      <div className="App">
        Generating {SHAPE_COUNT.toLocaleString()} shapes...
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Konva Export Demo - {SHAPE_COUNT.toLocaleString()} Shapes</h1>
      <p className="instructions">
        Click to select and drag shapes. Use handles to resize. Scroll to zoom
        in/out.
      </p>
      <div className="stage-container">
        <Stage
          width={800}
          height={800}
          ref={stageRef}
          onWheel={handleWheel}
          scaleX={SCALE}
          scaleY={SCALE}
          x={stagePos.x}
          y={stagePos.y}
          onMouseDown={checkDeselect}
          onTouchStart={checkDeselect}
          draggable
        >
          <Layer>
            {shapes.map((shape, i) => (
              <Shape
                key={i}
                shapeProps={shape}
                isSelected={shape.id === selectedId}
                onSelect={() => setSelectedId(shape.id)}
                onChange={(newAttrs) => {
                  const newShapes = shapes.slice();
                  newShapes[i] = newAttrs;
                  setShapes(newShapes);
                }}
              />
            ))}
          </Layer>
        </Stage>
      </div>
      <div className="controls">
        <div className="export-buttons">
          <button onClick={handleRegularExport}>Regular Export</button>
          <button onClick={handleMinifiedExport}>Minified Export</button>
          <button onClick={handleOptimizedExport}>Optimized Export</button>
          <button onClick={handleCompressedExport}>Compressed Export</button>
        </div>
        {fileSize && (
          <p>
            {lastExportMethod.charAt(0).toUpperCase() +
              lastExportMethod.slice(1)}{" "}
            export size: {(fileSize / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root"));
root.render(<App />);
