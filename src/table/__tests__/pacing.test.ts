import { PACING, pacingFor } from '../pacing';

describe('game speed', () => {
  test('fast cuts the wait per bot turn by more than half', () => {
    const turn = (p: { thinkMs: number; displayMs: number }) => p.thinkMs + p.displayMs;
    expect(turn(PACING.fast)).toBeLessThan(turn(PACING.normal) / 2);
  });

  test('the caption outlasts the hold at every speed', () => {
    for (const p of Object.values(PACING)) expect(p.captionMs).toBeGreaterThan(p.displayMs);
  });

  test('an unknown saved speed plays at normal', () => {
    expect(pacingFor('fast')).toBe(PACING.fast);
    expect(pacingFor(undefined)).toBe(PACING.normal);
    expect(pacingFor('ludicrous')).toBe(PACING.normal);
  });
});
