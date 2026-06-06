import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

mkdirSync("public/uploads", { recursive: true });
mkdirSync("public", { recursive: true });

// Square logo: navy circle with white "T" — matches the attached design.
const SIZE = 512;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0B3D8F"/>
      <stop offset="100%" stop-color="#0A2D6E"/>
    </linearGradient>
  </defs>
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2 - 8}" fill="url(#bg)"/>
  <g fill="#FFFFFF">
    <!-- Top bar of T -->
    <rect x="${SIZE * 0.28}" y="${SIZE * 0.30}" width="${SIZE * 0.44}" height="${SIZE * 0.10}" rx="4"/>
    <!-- Vertical stem -->
    <rect x="${SIZE * 0.435}" y="${SIZE * 0.30}" width="${SIZE * 0.13}" height="${SIZE * 0.42}" rx="4"/>
  </g>
</svg>
`;

const buf = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync("public/uploads/tertiary-logo.png", buf);
writeFileSync("public/icon.png", buf);
writeFileSync("public/apple-icon.png", buf);
// favicon.ico expects ICO format; sharp can output as PNG only.
// Most modern browsers happily use /icon.png. Save the PNG bytes to .ico as a fallback.
writeFileSync("public/favicon.ico", buf);
console.log("wrote /public/uploads/tertiary-logo.png and icon variants (" + buf.length + " bytes)");
