import { normalizePowerData, normalizeVoltageData } from './utils';

describe('normalizePowerData', () => {
  it('should return 100 if power is 10 or greater', () => {
    expect(normalizePowerData(10)).toBe(100);
    expect(normalizePowerData(15)).toBe(100);
  });

  it('should return power multiplied by 10 if power is less than 10', () => {
    expect(normalizePowerData(5)).toBe(50);
    expect(normalizePowerData(0)).toBe(0);
    expect(normalizePowerData(9.9)).toBe(99);
  });
});

describe('normalizeVoltageData', () => {
  it('should return 100 if voltage is greater than 100', () => {
    expect(normalizeVoltageData(101)).toBe(100);
    expect(normalizeVoltageData(150)).toBe(100);
  });

  it('should return 0.0001 if voltage is 0', () => {
    expect(normalizeVoltageData(0)).toBe(0.0001);
  });

  it('should return the voltage if it is between 0 and 100 inclusive', () => {
    expect(normalizeVoltageData(50)).toBe(50);
    expect(normalizeVoltageData(100)).toBe(100);
    expect(normalizeVoltageData(0.1)).toBe(0.1);
  });
});
