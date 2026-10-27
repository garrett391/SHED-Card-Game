import { isUnlocked } from '../campaignStore';

describe('isUnlocked', () => {
  test('a node opens when the one before it is beaten', () => {
    expect(isUnlocked({}, 'jake-classic')).toBe(true);
    expect(isUnlocked({}, 'the-spreading')).toBe(false);
    expect(isUnlocked({ 'jake-classic': true }, 'the-spreading')).toBe(true);
  });

  test('a node you already beat stays open after a new node is inserted before it', () => {
    // A save from before the Outlaw Pass existed: Super Tens and Chaos Shed beaten.
    const old = { 'jake-classic': true, 'the-spreading': true, 'justins-schism': true,
      'super-tens': true, 'chaos-shed': true } as const;
    expect(isUnlocked(old, 'the-pass')).toBe(true);
    expect(isUnlocked(old, 'chaos-shed')).toBe(true);
  });
});
