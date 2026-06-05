import { useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import { Button } from "#/components/ui/Button";
import { Modal } from "#/components/ui/Modal";
import type { ImageCrop } from "#/lib/deck";
import { clampCrop, createCenteredCrop, getImageCropStyle, zoomCrop } from "#/lib/imageCrop";

type CropModalImage = {
  id: string;
  name: string;
  imageUrl: string;
  crop?: ImageCrop;
};

type ImageCropModalProps = {
  title: string;
  images: CropModalImage[];
  aspectRatio: number;
  onClose: () => void;
  onSave: (cropsById: Record<string, ImageCrop>) => void;
};

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  crop: ImageCrop;
  width: number;
  height: number;
};

export function ImageCropModal({
  title,
  images,
  aspectRatio,
  onClose,
  onSave,
}: ImageCropModalProps) {
  const [cropsById, setCropsById] = useState<Record<string, ImageCrop>>(() =>
    Object.fromEntries(images.flatMap((image) => (image.crop ? [[image.id, image.crop]] : []))),
  );
  const [baseCropsById, setBaseCropsById] = useState<Record<string, ImageCrop>>({});
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());
  const dragStateRef = useRef<DragState | null>(null);
  const isReady = images.every((image) => cropsById[image.id]);

  function handleImageLoad(image: CropModalImage, event: SyntheticEvent<HTMLImageElement>) {
    const element = event.currentTarget;
    const imageAspectRatio = element.naturalWidth / element.naturalHeight;
    const baseCrop = createCenteredCrop(imageAspectRatio, aspectRatio);
    setBaseCropsById((current) => ({ ...current, [image.id]: baseCrop }));
    setCropsById((current) => ({
      ...current,
      [image.id]: clampCrop(current[image.id] ?? image.crop ?? baseCrop),
    }));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, id: string) {
    const crop = cropsById[id];
    if (!crop) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop,
      width: event.currentTarget.clientWidth,
      height: event.currentTarget.clientHeight,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    setCropsById((current) => ({
      ...current,
      [dragState.id]: clampCrop({
        ...dragState.crop,
        x: dragState.crop.x - (deltaX / dragState.width) * dragState.crop.width,
        y: dragState.crop.y - (deltaY / dragState.height) * dragState.crop.height,
      }),
    }));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
  }

  function handleZoomChange(id: string, zoom: number) {
    const baseCrop = baseCropsById[id];
    const crop = cropsById[id];
    if (!baseCrop || !crop) return;

    setCropsById((current) => ({ ...current, [id]: zoomCrop(baseCrop, crop, zoom) }));
  }

  return (
    <Modal
      ariaLabel="Close image crop modal"
      className="items-center justify-center overflow-y-auto overscroll-contain p-6"
      maxWidth="4xl"
      panelClassName="max-h-[85vh] overflow-y-auto p-6"
      onClose={onClose}
    >
      <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
      <div className={`mt-5 grid gap-5 ${images.length > 1 ? "md:grid-cols-2" : ""}`}>
        {images.map((image) => {
          const crop = cropsById[image.id];
          const baseCrop = baseCropsById[image.id];
          const zoom = crop && baseCrop ? Math.max(1, baseCrop.width / crop.width) : 1;
          const hasFailed = failedImageIds.has(image.id);

          return (
            <div key={image.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-zinc-100">{image.name}</p>
                <p className="text-xs text-zinc-500">Drag to position</p>
              </div>
              <div
                role="presentation"
                onPointerDown={(event) => handlePointerDown(event, image.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 touch-none"
                style={{ aspectRatio }}
              >
                {hasFailed ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-300">
                    Could not load this image URL.
                  </div>
                ) : (
                  <img
                    src={image.imageUrl}
                    alt={image.name}
                    draggable={false}
                    onLoad={(event) => handleImageLoad(image, event)}
                    onError={() => setFailedImageIds((current) => new Set([...current, image.id]))}
                    className="select-none object-fill"
                    style={crop ? getImageCropStyle(crop) : undefined}
                  />
                )}
              </div>
              <label
                className="block text-xs font-medium text-zinc-500"
                htmlFor={`crop-${image.id}`}
              >
                Zoom
              </label>
              <input
                id={`crop-${image.id}`}
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                aria-label={`${image.name} zoom`}
                disabled={!crop || !baseCrop || hasFailed}
                onChange={(event) => handleZoomChange(image.id, Number(event.target.value))}
                className="w-full accent-cyan-400 disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex gap-2">
        <Button onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!isReady || failedImageIds.size > 0}
          onClick={() => onSave(cropsById)}
          className="flex-1"
        >
          Save crop
        </Button>
      </div>
    </Modal>
  );
}
