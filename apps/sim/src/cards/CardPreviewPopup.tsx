import type { GameObject } from "@deckdiff/schemas";
import type { SimCardImage } from "./cardImages.js";

export function CardPreviewPopup({
  object,
  image,
  side,
}: {
  object: GameObject;
  image?: SimCardImage | null;
  side: "left" | "right";
}) {
  if (!image?.frontImageUrl) return null;

  const images = image.alternateImageUrl
    ? [image.frontImageUrl, image.alternateImageUrl]
    : [image.frontImageUrl];

  return (
    <div className={`card-preview-popup card-preview-popup-${side}`} aria-hidden="true">
      {images.map((imageUrl, index) => (
        <img
          key={imageUrl}
          className={[
            "card-preview-image",
            image.shouldRotatePreview ? "card-preview-image-sideways" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          src={imageUrl}
          alt={index === 0 ? object.name : `${object.name} alternate face`}
          draggable={false}
        />
      ))}
    </div>
  );
}
