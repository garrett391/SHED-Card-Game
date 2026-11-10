import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from '../profileStore';

describe('settings are remembered', () => {
  test('speed, sound and station are saved with the name', async () => {
    const s = useProfileStore.getState();
    s.setGameSpeed('fast');
    s.setSfxMuted(true);
    s.setRadioStationId('jazz-radio-lounge');
    const saved = JSON.parse((await AsyncStorage.getItem('shed-profile-v1'))!).state;
    expect(saved).toMatchObject({
      gameSpeed: 'fast', sfxMuted: true, radioStationId: 'jazz-radio-lounge',
    });
  });

  test('a profile saved before these settings existed gets the defaults', async () => {
    useProfileStore.setState({ gameSpeed: 'normal', sfxMuted: false, radioStationId: null });
    await AsyncStorage.setItem('shed-profile-v1', JSON.stringify({
      state: { playerName: 'Garrett' }, version: 0,
    }));
    await useProfileStore.persist.rehydrate();
    expect(useProfileStore.getState()).toMatchObject({
      playerName: 'Garrett', gameSpeed: 'normal', sfxMuted: false, radioStationId: null,
    });
  });
});
