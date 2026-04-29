import { z } from "zod";

export const playerIdSchema = z.string().min(1);
export const cardIdSchema = z.string().min(1);
export const objectIdSchema = z.string().min(1);

export const zoneSchema = z.enum([
  "library",
  "hand",
  "battlefield",
  "stack",
  "graveyard",
  "exile",
  "command",
]);

export const phaseSchema = z.enum([
  "beginning",
  "precombatMain",
  "combat",
  "postcombatMain",
  "ending",
]);

export const stepSchema = z.enum([
  "untap",
  "upkeep",
  "draw",
  "beginningOfCombat",
  "declareAttackers",
  "declareBlockers",
  "combatDamage",
  "endOfCombat",
  "end",
  "cleanup",
]);

export const zonePositionSchema = z.enum(["top", "bottom"]);

export const objectKindSchema = z.enum([
  "card",
  "token",
  "copy",
  "spell",
  "activatedAbility",
  "triggeredAbility",
]);

export const objectStatusSchema = z.object({
  tapped: z.boolean(),
  faceDown: z.boolean(),
  flipped: z.boolean(),
  phasedOut: z.boolean(),
});

export const visibilityOverrideSchema = z.object({
  revealedTo: z.union([z.literal("all"), z.array(playerIdSchema).min(1)]),
});

export const zoneRefSchema = z.object({
  zone: zoneSchema,
  playerId: playerIdSchema.optional(),
});

export const counterSchema = z.object({
  type: z.string().min(1),
  amount: z.number().int(),
});

export const gameObjectSchema = z.object({
  objectId: objectIdSchema,
  cardId: cardIdSchema.optional(),
  kind: objectKindSchema,
  ownerPlayerId: playerIdSchema.optional(),
  controllerPlayerId: playerIdSchema.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  counters: z.array(counterSchema),
  status: objectStatusSchema,
  annotations: z.array(z.string()),
  copySourceObjectId: objectIdSchema.optional(),
  visibility: visibilityOverrideSchema.optional(),
});

export const zoneStateSchema = z.object({
  objects: z.array(gameObjectSchema),
});

export const playerZonesSchema = z.object({
  library: zoneStateSchema,
  hand: zoneStateSchema,
  graveyard: zoneStateSchema,
});

export const playerStateSchema = z.object({
  id: playerIdSchema,
  name: z.string().min(1),
  life: z.number().int(),
  counters: z.array(counterSchema),
  zones: playerZonesSchema,
});

export const gameEventSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  timestamp: z.string().min(1),
  type: z.string().min(1),
  actorPlayerId: playerIdSchema.optional(),
  message: z.string(),
  commandType: z.string().optional(),
});

export const gameStateSchema = z.object({
  id: z.literal("single"),
  revision: z.number().int().nonnegative(),
  players: z.array(playerStateSchema),
  activePlayerId: playerIdSchema.optional(),
  priorityPlayerId: playerIdSchema.optional(),
  turnNumber: z.number().int().nonnegative().optional(),
  phase: phaseSchema.optional(),
  step: stepSchema.optional(),
  zones: z.object({
    battlefield: zoneStateSchema,
    stack: zoneStateSchema,
    exile: zoneStateSchema,
    command: zoneStateSchema,
  }),
  eventLog: z.array(gameEventSchema),
});

export type PlayerId = z.infer<typeof playerIdSchema>;
export type CardId = z.infer<typeof cardIdSchema>;
export type ObjectId = z.infer<typeof objectIdSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Step = z.infer<typeof stepSchema>;
export type ZonePosition = z.infer<typeof zonePositionSchema>;
export type Counter = z.infer<typeof counterSchema>;
export type ObjectKind = z.infer<typeof objectKindSchema>;
export type ObjectStatus = z.infer<typeof objectStatusSchema>;
export type VisibilityOverride = z.infer<typeof visibilityOverrideSchema>;
export type ZoneRef = z.infer<typeof zoneRefSchema>;
export type GameObject = z.infer<typeof gameObjectSchema>;
export type ZoneState = z.infer<typeof zoneStateSchema>;
export type PlayerZones = z.infer<typeof playerZonesSchema>;
export type PlayerState = z.infer<typeof playerStateSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
