import * as THREE from "three";

export const createTextTexture = ({
  text,
  width,
  height,
  fontFamily = "DM Serif Display, Playfair Display, serif",
  fontSize = 64,
  color = "#f7f9ff",
  shadow = "rgba(0,0,0,0.6)"
}: {
  text: string;
  width: number;
  height: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  shadow?: string;
}): THREE.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = Math.max(8, fontSize * 0.22);
  ctx.shadowOffsetY = Math.max(4, fontSize * 0.1);

  const lines = text.split(/\n/);
  const lineHeight = fontSize * 1.18;
  const startY = canvas.height / 2 - (lines.length - 1) * lineHeight * 0.5;
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};

export const loadTexture = async (src: string): Promise<THREE.Texture> => {
  const loader = new THREE.TextureLoader();
  const texture = await loader.loadAsync(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
};
