import { describe, expect, it } from 'vitest';
import { convertUnit, isUnit } from './units.js';
import { IPCC_CATEGORIES, scopeOfCategory } from './ipcc.js';

describe('convertUnit', () => {
  it('converts MWh to kWh', () => {
    expect(convertUnit(1.5, 'MWh', 'kWh')).toBe(1500);
  });
  it('converts kg to tonne', () => {
    expect(convertUnit(2500, 'kg', 'tonne')).toBe(2.5);
  });
  it('returns identity for same unit', () => {
    expect(convertUnit(42, 'litre', 'litre')).toBe(42);
  });
  it('returns null for incompatible units', () => {
    expect(convertUnit(1, 'kWh', 'litre')).toBeNull();
  });
});

describe('isUnit', () => {
  it('accepts known units', () => {
    expect(isUnit('kWh')).toBe(true);
  });
  it('rejects unknown units', () => {
    expect(isUnit('gallon')).toBe(false);
  });
});

describe('ipcc categories', () => {
  it('every category maps to a scope', () => {
    for (const cat of IPCC_CATEGORIES) {
      expect(['scope1', 'scope2']).toContain(scopeOfCategory(cat));
    }
  });
});
