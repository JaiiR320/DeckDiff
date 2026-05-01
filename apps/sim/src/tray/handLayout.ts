export const handCardWidth = 120;

const cardAreaPadding = 4;
const naturalCardGap = 12;

export function handCardLeft(index: number, count: number, width: number): number {
  const availableWidth = Math.max(0, width - cardAreaPadding * 2);
  const maxLeft = Math.max(0, availableWidth - handCardWidth);
  if (count <= 1) return cardAreaPadding + maxLeft / 2;

  const naturalSpan = (count - 1) * (handCardWidth + naturalCardGap);
  if (naturalSpan <= maxLeft)
    return cardAreaPadding + (maxLeft - naturalSpan) / 2 + index * (handCardWidth + naturalCardGap);

  return cardAreaPadding + (index * maxLeft) / (count - 1);
}

export function handCardCenter(index: number, count: number, width: number): number {
  return handCardLeft(index, count, width) + handCardWidth / 2;
}

export function handInsertIndexFromClientX(
  clientX: number,
  handRect: DOMRectReadOnly,
  cardCount: number,
) {
  const localX = clientX - handRect.left;
  for (let index = 0; index < cardCount; index += 1) {
    if (localX < handCardCenter(index, cardCount, handRect.width)) return index;
  }

  return cardCount;
}
