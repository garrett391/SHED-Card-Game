import { CHARACTERS, endLine, endLinesFor, opponentsFor, robLine, VARIANT_OPPONENTS } from '../characters';

describe('end lines', () => {
  test('every campaign host has a win and a loss line at each table they host', () => {
    for (const [presetId, ids] of Object.entries(VARIANT_OPPONENTS)) {
      for (const c of opponentsFor(presetId)) {
        const lines = endLinesFor(c, presetId);
        expect(lines?.playerWon.length).toBeGreaterThan(0);
        expect(lines?.playerLost.length).toBeGreaterThan(0);
      }
      expect(ids.length).toBeGreaterThan(0);
    }
  });

  test('a table of its own wins over general lines', () => {
    const justin = CHARACTERS.justin;
    const council = justin.tableEndLines!['the-council'];
    for (let i = 0; i < 20; i++) {
      expect(council.playerWon).toContain(endLine(justin, true, 'the-council'));
      expect(council.playerLost).toContain(endLine(justin, false, 'the-council'));
    }
  });

  test('a host without lines for the table falls back to their general lines', () => {
    const greg = CHARACTERS.greg;
    expect(greg.endLines!.playerWon).toContain(endLine(greg, true, 'super-tens'));
  });
});

describe('robLine', () => {
  test('fills in the card a bandit took', () => {
    const chief = CHARACTERS['bandit-chief'];
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.4); // index 1: the {card} line
    expect(robLine(chief, 'selfRob', 'K♠')).toBe('Now just pass over that K♠ and no one gets hurt.');
    spy.mockRestore();
  });

  test('characters without stick-up lines stay quiet', () => {
    expect(robLine(CHARACTERS.jake, 'selfRob', 'K♠')).toBeNull();
  });
});
