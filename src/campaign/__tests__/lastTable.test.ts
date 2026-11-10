import { restoreTable, toSavedTable } from '../lastTable';

const FOUR = [
  { name: 'Garrett', isBot: false },
  { name: 'Nick', isBot: false },
  { name: 'Greg', isBot: true, botStyle: 'sharp' as const },
  { name: 'Bot 1', isBot: true },
];

describe('remembering the last free-play table', () => {
  test('the seats and variant come back as they were dealt', () => {
    const saved = toSavedTable('super-tens', FOUR);
    expect(restoreTable(saved, { 'super-tens': true })).toEqual({
      modeId: 'super-tens',
      players: FOUR,
    });
  });

  test("seat rules aren't saved with the seats", () => {
    const saved = toSavedTable('jake-classic', [
      { name: 'You', isBot: false },
      { name: 'Justin', isBot: true, rules: { id: 'x' } as never },
    ]);
    expect(saved.seats[1]).toEqual({ name: 'Justin', isBot: true });
  });

  test('a variant that is no longer open falls back to the classic, seats kept', () => {
    const saved = toSavedTable('super-tens', FOUR);
    expect(restoreTable(saved, {})).toEqual({ modeId: 'jake-classic', players: FOUR });
    expect(restoreTable({ ...saved, modeId: 'gone' }, {})?.modeId).toBe('jake-classic');
  });

  test('nothing saved, or a save that makes no sense, restores nothing', () => {
    expect(restoreTable(null, {})).toBeNull();
    expect(restoreTable({ modeId: 'jake-classic' }, {})).toBeNull();
    expect(restoreTable({ modeId: 'jake-classic', seats: [FOUR[0]] }, {})).toBeNull();
    expect(restoreTable({ modeId: 'jake-classic', seats: [{ name: 1 }, FOUR[1]] }, {})).toBeNull();
    const seven = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, isBot: true }));
    expect(restoreTable({ modeId: 'jake-classic', seats: seven }, {})).toBeNull();
  });
});
