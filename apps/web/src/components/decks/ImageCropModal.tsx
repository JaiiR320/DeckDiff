import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Label } from "@jaiir320/design-system/components/label";
import { useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
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
  const popupRef = useRef<HTMLDivElement>(null);
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        ref={popupRef}
        tabIndex={-1}
        initialFocus={popupRef}
        size="4xl"
        className="max-h-[85vh] overflow-y-auto"
      >
        <DialogTitle>{title}</DialogTitle>
        <div className={`mt-5 grid gap-5 ${images.length > 1 ? "md:grid-cols-2" : ""}`}>
          {images.map((image) => {
            const crop = cropsById[image.id];
            const baseCrop = baseCropsById[image.id];
            const zoom = crop && baseCrop ? Math.max(1, baseCrop.width / crop.width) : 1;
            const hasFailed = failedImageIds.has(image.id);

            return (
              <div key={image.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{image.name}</p>
                  <p className="text-xs text-muted-foreground">Drag to position</p>
                </div>
                <div
                  role="presentation"
                  onPointerDown={(event) => handlePointerDown(event, image.id)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="relative overflow-hidden rounded-xl border border-border bg-surface touch-none"
                  style={{ aspectRatio }}
                >
                  {hasFailed ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive-muted-foreground">
                      Could not load this image URL.
                    </div>
                  ) : (
                    <img
                      src={image.imageUrl}
                      alt={image.name}
                      draggable={false}
                      onLoad={(event) => handleImageLoad(image, event)}
                      onError={() =>
                        setFailedImageIds((current) => new Set([...current, image.id]))
                      }
                      className="select-none object-fill"
                      style={crop ? getImageCropStyle(crop) : undefined}
                    />
                  )}
                </div>
                <Label className="text-xs text-muted-foreground" htmlFor={`crop-${image.id}`}>
                  Zoom
                </Label>
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
                  className="w-full accent-primary disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>
        <DialogFooter layout="stretch" className="mt-6">
          <DialogClose render={<Button />}>Cancel</DialogClose>
          <Button
            variant="default"
            disabled={!isReady || failedImageIds.size > 0}
            onClick={() => onSave(cropsById)}
          >
            Save crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
