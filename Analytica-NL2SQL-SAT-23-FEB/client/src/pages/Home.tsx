import React, { useState, useRef, useEffect } from "react";

export default function Home() {
  const [targetX, setTargetX] = useState(1000);
  const [targetY, setTargetY] = useState(200);
  const [actualX, setActualX] = useState(1000);
  const [actualY, setActualY] = useState(200);

  const svgRef = useRef<SVGSVGElement>(null);

  // Smooth easing toward the mouse target
  useEffect(() => {
    let rafId: number;

    const animate = () => {
      setActualX((prev) => prev + 0.1 * (targetX - prev));
      setActualY((prev) => prev + 0.1 * (targetY - prev));
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [targetX, targetY]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 0) return; // ignore clicks/drag

    const svgEl = svgRef.current;
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Our viewBox is 2000 x 400 => 5:1 ratio
    const viewBoxWidth = 2000;
    const viewBoxHeight = 400;
    const viewBoxAspect = viewBoxWidth / viewBoxHeight;
    const containerAspect = containerWidth / containerHeight;

    let scaleFactor, displayedWidth, displayedHeight, offsetX, offsetY;

    // Letterboxing logic
    if (containerAspect > viewBoxAspect) {
      scaleFactor = containerHeight / viewBoxHeight;
      displayedWidth = viewBoxWidth * scaleFactor;
      displayedHeight = containerHeight;
      offsetX = rect.left + (containerWidth - displayedWidth) / 2;
      offsetY = rect.top;
    } else {
      scaleFactor = containerWidth / viewBoxWidth;
      displayedWidth = containerWidth;
      displayedHeight = viewBoxHeight * scaleFactor;
      offsetX = rect.left;
      offsetY = rect.top + (containerHeight - displayedHeight) / 2;
    }

    const mouseLocalX = e.clientX - offsetX;
    const mouseLocalY = e.clientY - offsetY;

    // Map [0..displayedWidth] => [0..2000], etc.
    const newSvgX = (mouseLocalX / displayedWidth) * viewBoxWidth;
    const newSvgY = (mouseLocalY / displayedHeight) * viewBoxHeight;

    setTargetX(newSvgX);
    setTargetY(newSvgY);
  };

  return (
    <div style={{ margin: 0, padding: 0 }}>
      {/* SECTION 1 (Hero) */}
      <section
        style={{
          width: "100vw",
          height: "100vh",
          background: "#000",
          position: "relative",
          overflow: "hidden",
          cursor: "default",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        onMouseMove={handleMouseMove}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="0 0 2000 400"
          preserveAspectRatio="xMidYMid meet"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            {/* 1) Vertical gradient for the gray text stroke */}
            <linearGradient id="grayVertical" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#444" />
              <stop offset="100%" stopColor="#111" />
            </linearGradient>

            {/* 2) Diagonal gradient for the "colorful" text */}
            <linearGradient id="gradStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff006e" />
              <stop offset="20%" stopColor="#f72585" />
              <stop offset="40%" stopColor="#7209b7" />
              <stop offset="60%" stopColor="#3a0ca3" />
              <stop offset="80%" stopColor="#66ff66" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            {/* Feathered radial gradient for the spotlight mask */}
            <radialGradient
              id="featherGradient"
              gradientUnits="objectBoundingBox"
              cx="0.5"
              cy="0.5"
              r="0.5"
            >
              <stop offset="80%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>

            {/* Mask that reveals the color stroke within the circle */}
            <mask id="gradMask">
              <rect x="0" y="0" width="2000" height="400" fill="black" />
              <circle
                cx={actualX}
                cy={actualY}
                r="100"
                fill="url(#featherGradient)"
              />
            </mask>
          </defs>

          {/* Gray text has a vertical gradient stroke */}
          <text
            style={{ pointerEvents: "none" }}
            x="50%"
            y="50%"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="300"
            fill="none"
            stroke="url(#grayVertical)"
            strokeWidth="1"
          >
            ANALYTICA
          </text>

          {/* Color stroke is masked (spotlight effect) and slightly thicker */}
          <text
            style={{ pointerEvents: "none" }}
            x="50%"
            y="50%"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="300"
            fill="none"
            stroke="url(#gradStroke)"
            strokeWidth="1.3"
            mask="url(#gradMask)"
          >
            ANALYTICA
          </text>
        </svg>
      </section>

      {/* SECTION 2 */}
      <section
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <h2>SECTION 2</h2>
      </section>

      {/* SECTION 3 */}
      <section
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <h2>SECTION 3</h2>
      </section>

      {/* SECTION 4 */}
      <section
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <h2>SECTION 4</h2>
      </section>

      {/* SECTION 5 */}
      <section
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <h2>SECTION 5</h2>
      </section>

      {/* SECTION 6 */}
      <section
        style={{
          minHeight: "100vh",
          background: "#000",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "#fff",
        }}
      >
        <h2>SECTION 6</h2>
      </section>
    </div>
  );
}
