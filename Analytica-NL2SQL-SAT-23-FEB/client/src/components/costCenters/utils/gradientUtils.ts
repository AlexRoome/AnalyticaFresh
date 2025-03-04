// /client/src/components/costCenters/utils/gradientUtils.ts

function randomColor(): string {
  // 1) Full hue range for variety (0..359).
  const h = Math.floor(Math.random() * 360);

  // 2) Slightly lower saturation to desaturate: e.g. 30..70 instead of 40..100
  const s = Math.floor(Math.random() * 41) + 30; 
  // This yields a range of 30–70% saturation.

  // 3) Lightness can remain 30..80 or any range you like for moderate brightness.
  const l = Math.floor(Math.random() * 51) + 30; 
  // Range: 30–80% lightness.

  return `hsl(${h}, ${s}%, ${l}%)`;
}

/**
 * Returns a random linear gradient with 2 moderately desaturated colors
 * at a random angle. Retains full hue coverage, but is less vibrant overall.
 */
export function getRandomGradient(): string {
  const color1 = randomColor();
  const color2 = randomColor();
  const angle = Math.floor(Math.random() * 360);
  return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
}
