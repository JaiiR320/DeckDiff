import { useState } from "react";
import { ImageCropModal } from "#/components/decks/ImageCropModal";
import { ExportDeckModal } from "./modals/ExportDeckModal";
import { ImportDeckModal } from "./modals/ImportDeckModal";
import { SaveDeckModal } from "./modals/SaveDeckModal";
import { DeckActionsModal } from "#/components/decks/DeckActionsModal";
import type { DeckItem } from "#/lib/deck";
import { swapSplitDeckCover } from "#/lib/deckCover";
import {
  useDeckDetailModel,
  useDeckDetailServices,
  useDeckWorkspaceActions,
  useDeckWorkspaceView,
} from "./deckDetailContext";

export function DeckDetailModals() {
  const { categories, compareMode, deck, stackLayout, workingCards } = useDeckWorkspaceView();
  const { defaultSaveLabel, exportPreview, hasCards } = useDeckDetailModel();
  const workspaceActions = useDeckWorkspaceActions();
  const { deckActions, deckImport } = useDeckDetailServices();
  const [cropDeck, setCropDeck] = useState<DeckItem | null>(null);

  return (
    <>
      {deckImport.isImportOpen ? (
        <ImportDeckModal
          hasCards={hasCards}
          draftDeck={deckImport.draftDeck}
          onDraftDeckChange={deckImport.setDraftDeck}
          onClose={deckImport.closeImportModal}
          onSubmit={deckImport.submitImport}
          onOverride={() => void deckImport.importDraftDeck("override")}
        />
      ) : null}

      {deckImport.isExportOpen ? (
        <ExportDeckModal
          exportOptions={deckImport.exportOptions}
          exportPreview={exportPreview}
          onClose={() => deckImport.setIsExportOpen(false)}
          onCopy={() =>
            void navigator.clipboard
              .writeText(exportPreview)
              .then(() => deckImport.setIsExportOpen(false))
          }
          onToggleAddedOnly={deckImport.toggleExportAddedOnly}
          onToggleGroupByCategory={deckImport.toggleExportGroupByCategory}
          onToggleIncludeOutOfDeckCategories={deckImport.toggleExportIncludeOutOfDeckCategories}
          onToggleIncludeQuantity={deckImport.toggleExportQuantity}
        />
      ) : null}

      {deckActions.isSaveOpen ? (
        <SaveDeckModal
          defaultLabel={defaultSaveLabel}
          isOpen={deckActions.isSaveOpen}
          onClose={deckActions.closeSaveModal}
          onSave={(label) =>
            void deckActions.saveDeck(label).then((saved) => {
              if (saved) workspaceActions.onClearUndoHistory();
            })
          }
        />
      ) : null}

      {deckActions.isDeckActionsOpen ? (
        <DeckActionsModal
          deck={deck}
          isOpen={deckActions.isDeckActionsOpen}
          onClose={() => deckActions.setIsDeckActionsOpen(false)}
          onRename={(id, name) => void deckActions.renameDeck(id, name)}
          onDelete={(id) => void deckActions.deleteDeck(id)}
          onExport={deckActions.exportDeck}
          onColorsChange={(colors) => void deckActions.setDeckColors(colors)}
          onClearCover={() => void deckActions.setDeckCover(null)}
          onEditCoverCrop={(deck) => {
            setCropDeck(deck);
            deckActions.setIsDeckActionsOpen(false);
          }}
          onSwapSplitCover={(deck) =>
            void deckActions.setDeckCover(deck.cover ? swapSplitDeckCover(deck.cover) : null)
          }
          categories={categories}
          cards={workingCards}
          showRemovedCardGhosts={stackLayout.showRemovedCardGhosts !== false}
          onAddLane={compareMode ? undefined : workspaceActions.onAddStackLane}
          onCategoriesChange={compareMode ? undefined : workspaceActions.onReplaceCategories}
          onShowRemovedCardGhostsChange={
            compareMode ? undefined : workspaceActions.onSetShowRemovedCardGhosts
          }
        />
      ) : null}

      {cropDeck?.cover ? (
        <ImageCropModal
          title="Edit cover crop"
          aspectRatio={3 / 2}
          images={
            cropDeck.cover.kind === "split"
              ? cropDeck.cover.cards.map((card, index) => ({
                  id: String(index),
                  name: card.name,
                  imageUrl: card.imageUrl,
                  crop: card.crop,
                }))
              : [
                  {
                    id: "single",
                    name: cropDeck.cover.name,
                    imageUrl: cropDeck.cover.imageUrl,
                    crop: cropDeck.cover.crop,
                  },
                ]
          }
          onClose={() => setCropDeck(null)}
          onSave={(cropDeckCrops) => {
            if (!cropDeck.cover) return;

            if (cropDeck.cover.kind === "split") {
              const nextCards: typeof cropDeck.cover.cards = [
                { ...cropDeck.cover.cards[0], crop: cropDeckCrops["0"] },
                { ...cropDeck.cover.cards[1], crop: cropDeckCrops["1"] },
              ];

              void deckActions
                .setDeckCover({ ...cropDeck.cover, cards: nextCards })
                .then(() => setCropDeck(null));
              return;
            }

            void deckActions
              .setDeckCover({ ...cropDeck.cover, crop: cropDeckCrops.single })
              .then(() => setCropDeck(null));
          }}
        />
      ) : null}
    </>
  );
}
