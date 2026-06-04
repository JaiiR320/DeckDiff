import type { CSSProperties } from "react";
import type { ImageCrop } from "./deck";

export function createCenteredCrop(imageAspectRatio: number, targetAspectRatio: number): ImageCrop {
  if (imageAspectRatio > targetAspectRatio) {
    const width = targetAspectRatio / imageAspectRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }

  const height = imageAspectRatio / targetAspectRatio;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function clampCrop(crop: ImageCrop): ImageCrop {
  const width = clamp(crop.width, 0.01, 1);
  const height = clamp(crop.height, 0.01, 1);

  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

export function zoomCrop(baseCrop: ImageCrop, currentCrop: ImageCrop, zoom: number): ImageCrop {
  const nextWidth = baseCrop.width / zoom;
  const nextHeight = baseCrop.height / zoom;
  const centerX = currentCrop.x + currentCrop.width / 2;
  const centerY = currentCrop.y + currentCrop.height / 2;

  return clampCrop({
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  });
}

export function getImageCropStyle(crop: ImageCrop): CSSProperties {
  return {
    position: "absolute",
    left: `${-(crop.x / crop.width) * 100}%`,
    top: `${-(crop.y / crop.height) * 100}%`,
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    maxWidth: "none",
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
