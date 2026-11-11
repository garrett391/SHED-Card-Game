import {
  campaignPlace,
  FOLLOW_CAMPAIGN,
  HOME_SCENES,
  homeScene,
  unlockedScenes,
} from '../homeScenes';
import { PRESET_ORDER } from '../presets';

const beaten = (...ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, true])) as Record<string, true>;
const upTo = (id: string) => beaten(...PRESET_ORDER.slice(0, PRESET_ORDER.indexOf(id) + 1));

test('every scene belongs to a campaign table, in ladder order, once', () => {
  const at = HOME_SCENES.map((s) => PRESET_ORDER.indexOf(s.id));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
  expect(new Set(at).size).toBe(at.length);
  expect(HOME_SCENES[0].id).toBe(PRESET_ORDER[0]);
});

describe('following the campaign', () => {
  test('a new player sits in Jake\'s wood', () => {
    expect(homeScene({}, null).id).toBe('jake-classic');
    expect(homeScene({}, FOLLOW_CAMPAIGN).id).toBe('jake-classic');
  });

  test('Home moves on with the heroes', () => {
    expect(campaignPlace(beaten('jake-classic'))).toBe('the-spreading');
    expect(homeScene(beaten('jake-classic'), null).id).toBe('the-spreading');
    expect(homeScene(upTo('the-spreading'), null).id).toBe('justins-schism');
    expect(homeScene(upTo('super-tens'), null).id).toBe('the-pass');
  });

  test('a table without a scene borrows the nearest earlier one', () => {
    // Standing at the Second Schism, then the Council: no art yet.
    expect(homeScene(upTo('chaos-shed'), null).id).toBe('chaos-shed');
    expect(homeScene(upTo('second-schism'), null).id).toBe('chaos-shed');
  });

  test('with every table beaten it stays at the last scene', () => {
    const all = upTo(PRESET_ORDER[PRESET_ORDER.length - 1]);
    expect(campaignPlace(all)).toBe(PRESET_ORDER[PRESET_ORDER.length - 1]);
    expect(homeScene(all, null).id).toBe(HOME_SCENES[HOME_SCENES.length - 1].id);
  });
});

describe('pinning a scene', () => {
  test('beating a table unlocks its scene; the first is always open', () => {
    expect(unlockedScenes({}).map((s) => s.id)).toEqual(['jake-classic']);
    expect(unlockedScenes(upTo('the-spreading')).map((s) => s.id)).toEqual([
      'jake-classic', 'the-spreading',
    ]);
  });

  test('a pinned scene stays put as the campaign moves on', () => {
    expect(homeScene(upTo('the-pass'), 'jake-classic').id).toBe('jake-classic');
    expect(homeScene(upTo('the-pass'), 'the-spreading').id).toBe('the-spreading');
  });

  test('a pin that is no longer unlocked falls back to following', () => {
    expect(homeScene({}, 'the-pass').id).toBe('jake-classic');
    expect(homeScene({}, 'nowhere').id).toBe('jake-classic');
  });
});
