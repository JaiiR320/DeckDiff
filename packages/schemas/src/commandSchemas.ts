import { z } from "zod";
import {
  counterSchema,
  gameStateSchema,
  objectIdSchema,
  objectKindSchema,
  objectStatusSchema,
  phaseSchema,
  playerIdSchema,
  stepSchema,
  visibilityOverrideSchema,
  zoneRefSchema,
} from "./stateSchemas.js";

const insertIndexSchema = z.number().int().nonnegative();

const playerAddInputSchema = z.object({
  id: playerIdSchema,
  name: z.string().min(1),
});

const objectCreateInputSchema = z.object({
  kind: objectKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  cardId: z.string().min(1).optional(),
  ownerPlayerId: playerIdSchema.optional(),
  controllerPlayerId: playerIdSchema.optional(),
  counters: z.array(counterSchema).optional(),
  status: objectStatusSchema.partial().optional(),
  annotations: z.array(z.string()).optional(),
  copySourceObjectId: objectIdSchema.optional(),
  visibility: visibilityOverrideSchema.optional(),
});

export const newGameRequestSchema = z.object({
  players: z
    .array(
      z.object({
        id: playerIdSchema.optional(),
        name: z.string().min(1),
        life: z.number().int().optional(),
        library: z.array(z.string().min(1)).optional(),
        hand: z.array(z.string().min(1)).optional(),
        battlefield: z.array(z.string().min(1)).optional(),
        graveyard: z.array(z.string().min(1)).optional(),
        exile: z.array(z.string().min(1)).optional(),
        command: z.array(z.string().min(1)).optional(),
      }),
    )
    .default([]),
  activePlayerId: playerIdSchema.optional(),
  priorityPlayerId: playerIdSchema.optional(),
  turnNumber: z.number().int().nonnegative().optional(),
  phase: phaseSchema.optional(),
  step: stepSchema.optional(),
});

export const gameCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("player.add"),
    player: playerAddInputSchema,
  }),
  z.object({
    type: z.literal("player.rename"),
    playerId: playerIdSchema,
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("player.adjustLife"),
    playerId: playerIdSchema,
    delta: z.number().int(),
  }),
  z.object({
    type: z.literal("player.setLife"),
    playerId: playerIdSchema,
    life: z.number().int(),
  }),
  z.object({
    type: z.literal("player.setCounters"),
    playerId: playerIdSchema,
    counters: z.array(counterSchema),
  }),
  z.object({
    type: z.literal("object.create"),
    object: objectCreateInputSchema,
    to: zoneRefSchema,
    insertIndex: insertIndexSchema.optional(),
  }),
  z.object({
    type: z.literal("object.move"),
    objectId: objectIdSchema,
    to: zoneRefSchema,
    insertIndex: insertIndexSchema.optional(),
    kind: objectKindSchema.optional(),
    ownerPlayerId: playerIdSchema.optional(),
    controllerPlayerId: playerIdSchema.optional(),
    status: objectStatusSchema.partial().optional(),
    counters: z.array(counterSchema).optional(),
    visibility: visibilityOverrideSchema.optional(),
  }),
  z.object({ type: z.literal("object.delete"), objectId: objectIdSchema }),
  z.object({
    type: z.literal("object.copy"),
    sourceObjectId: objectIdSchema,
    to: zoneRefSchema,
    insertIndex: insertIndexSchema.optional(),
    kind: objectKindSchema.optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    ownerPlayerId: playerIdSchema.optional(),
    controllerPlayerId: playerIdSchema.optional(),
  }),
  z.object({
    type: z.literal("object.setStatus"),
    objectId: objectIdSchema,
    status: objectStatusSchema.partial(),
  }),
  z.object({
    type: z.literal("object.setCounters"),
    objectId: objectIdSchema,
    counters: z.array(counterSchema),
  }),
  z.object({
    type: z.literal("object.setController"),
    objectId: objectIdSchema,
    controllerPlayerId: playerIdSchema.nullable(),
  }),
  z.object({
    type: z.literal("object.setOwner"),
    objectId: objectIdSchema,
    ownerPlayerId: playerIdSchema.nullable(),
  }),
  z.object({
    type: z.literal("object.setVisibility"),
    objectId: objectIdSchema,
    visibility: visibilityOverrideSchema.nullable(),
  }),
  z.object({
    type: z.literal("object.setAnnotations"),
    objectId: objectIdSchema,
    annotations: z.array(z.string()),
  }),
  z.object({
    type: z.literal("zone.reorder"),
    zone: zoneRefSchema,
    objectIds: z.array(objectIdSchema),
  }),
  z.object({
    type: z.literal("zone.shuffle"),
    zone: zoneRefSchema,
  }),
  z.object({
    type: z.literal("zone.moveMany"),
    objectIds: z.array(objectIdSchema).min(1),
    to: zoneRefSchema,
    insertIndex: insertIndexSchema.optional(),
    kind: objectKindSchema.optional(),
  }),
  z.object({ type: z.literal("priority.set"), playerId: playerIdSchema.optional() }),
  z.object({ type: z.literal("priority.pass"), playerId: playerIdSchema.optional() }),
  z.object({
    type: z.literal("turn.set"),
    activePlayerId: playerIdSchema.optional(),
    turnNumber: z.number().int().nonnegative().optional(),
    phase: phaseSchema.optional(),
    step: stepSchema.optional(),
  }),
  z.object({
    type: z.literal("note.add"),
    actorPlayerId: playerIdSchema.optional(),
    message: z.string().min(1),
  }),
  z.object({ type: z.literal("state.replace"), state: gameStateSchema }),
]);

export type NewGameRequest = z.infer<typeof newGameRequestSchema>;
export type GameCommand = z.infer<typeof gameCommandSchema>;
