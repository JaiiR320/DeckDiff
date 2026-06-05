import { describe, expect, it } from "vitest";
import { clampCrop, createCenteredCrop, getImageCropStyle } from "./imageCrop";

describe("createCenteredCrop", () => {
  it("crops tall images vertically for a wide target", () => {
    expect(createCenteredCrop(0.7, 1.5)).toEqual({
      x: 0,
      y: expect.closeTo(0.2666666667),
      width: 1,
      height: expect.closeTo(0.4666666667),
    });
  });

  it("crops wide images horizontally for a narrower target", () => {
    expect(createCenteredCrop(2, 1)).toEqual({
      x: 0.25,
      y: 0,
      width: 0.5,
      height: 1,
    });
  });
});

describe("clampCrop", () => {
  it("keeps the crop inside the normalized image bounds", () => {
    expect(clampCrop({ x: 0.9, y: -0.2, width: 0.4, height: 1.2 })).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 1,
    });
  });
});

describe("getImageCropStyle", () => {
  it("scales and offsets an image to show the crop rect", () => {
    expect(getImageCropStyle({ x: 0.25, y: 0.1, width: 0.5, height: 0.5 })).toMatchObject({
      left: "-50%",
      top: "-20%",
      width: "200%",
      height: "200%",
    });
  });
});
