import { z } from 'zod';

/**
 * Shape both AI routes (search-plant, identify-plant) are prompted to
 * return. The model is not a type system: a missing season key or a
 * stringified number would otherwise flow straight into `PlantFormData`,
 * the `jsonb` columns, and `addDays`, where a non-number yields an
 * Invalid Date. Validate at the route boundary instead of trusting the
 * parsed JSON's shape.
 */
const seasonalFrequencySchema = z.object({
  spring: z.number(),
  summer: z.number(),
  fall: z.number(),
  winter: z.number(),
});

export const plantAiResponseSchema = z.object({
  name: z.string(),
  scientificName: z.string().optional().default(''),
  watering: seasonalFrequencySchema,
  fertilizing: seasonalFrequencySchema,
  repotting: seasonalFrequencySchema,
  careNotes: z.string().optional().default(''),
});

export type PlantAiResponse = z.infer<typeof plantAiResponseSchema>;
