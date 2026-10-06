import { describe, expect, it } from 'vitest';
import { plantAiResponseSchema } from '@/lib/plantAiSchema';

function validResponse(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Monstera Deliciosa',
    scientificName: 'Monstera deliciosa',
    watering: { spring: 7, summer: 5, fall: 10, winter: 14 },
    fertilizing: { spring: 21, summer: 21, fall: 30, winter: 0 },
    repotting: { spring: 730, summer: 730, fall: 730, winter: 730 },
    careNotes: 'Water when top 2 inches dry.',
    ...overrides,
  };
}

describe('plantAiResponseSchema', () => {
  it('accepts a well-formed response matching the prompt format', () => {
    const result = plantAiResponseSchema.safeParse(validResponse());
    expect(result.success).toBe(true);
  });

  it('defaults scientificName and careNotes when omitted', () => {
    const response = validResponse();
    delete (response as Record<string, unknown>).scientificName;
    delete (response as Record<string, unknown>).careNotes;

    const result = plantAiResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scientificName).toBe('');
      expect(result.data.careNotes).toBe('');
    }
  });

  it('rejects a response missing a season key', () => {
    const response = validResponse({ watering: { spring: 7, summer: 5, fall: 10 } });
    const result = plantAiResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects a response with a stringified number where a number is required', () => {
    const response = validResponse({
      fertilizing: { spring: 21, summer: 21, fall: 30, winter: '0' },
    });
    const result = plantAiResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects a response missing the name field', () => {
    const response = validResponse();
    delete (response as Record<string, unknown>).name;
    const result = plantAiResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects a response missing an entire care category', () => {
    const response = validResponse();
    delete (response as Record<string, unknown>).repotting;
    const result = plantAiResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});
