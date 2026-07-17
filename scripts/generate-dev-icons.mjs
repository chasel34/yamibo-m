import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ASSET_DIR = path.resolve('assets');

const files = [
  ['icon.png', 'icon-dev.png', { background: [238, 247, 255], hue: 214 }],
  ['android-icon-foreground.png', 'android-icon-foreground-dev.png', { hue: 214 }],
  ['android-icon-background.png', 'android-icon-background-dev.png', { background: [230, 244, 255] }],
  ['android-icon-monochrome.png', 'android-icon-monochrome-dev.png', { hue: 214 }],
];

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hueToRgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function isNearLightBackground(r, g, b, alpha) {
  return alpha > 0 && r > 235 && g > 232 && b > 238 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
}

function recolorPixel(r, g, b, alpha, options) {
  if (alpha === 0) return [r, g, b, alpha];
  if (options.background && isNearLightBackground(r, g, b, alpha)) {
    return [...options.background, alpha];
  }
  if (options.background && !options.hue) {
    return [...options.background, alpha];
  }

  const [h, s, l] = rgbToHsl(r, g, b);
  const targetHue = options.hue / 360;
  const targetSaturation = Math.min(0.9, Math.max(s, 0.48));
  const targetLightness = Math.max(0.28, Math.min(0.78, l));
  const [nr, ng, nb] = hslToRgb(targetHue, targetSaturation, targetLightness);
  return [nr, ng, nb, alpha];
}

for (const [source, target, options] of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(ASSET_DIR, source)));
  for (let i = 0; i < png.data.length; i += 4) {
    const [r, g, b, a] = png.data.subarray(i, i + 4);
    const [nr, ng, nb, na] = recolorPixel(r, g, b, a, options);
    png.data[i] = nr;
    png.data[i + 1] = ng;
    png.data[i + 2] = nb;
    png.data[i + 3] = na;
  }
  fs.writeFileSync(path.join(ASSET_DIR, target), PNG.sync.write(png));
}
