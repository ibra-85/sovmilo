import { getLiveEpoch, recordLiveError, refreshLiveData, subscribeLiveEpoch, takeLiveError } from './live-store';

describe('époque des données en direct', () => {
  it('chaque actualisation incrémente l\'époque et prévient chaque abonné une fois', () => {
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = subscribeLiveEpoch(first);
    const stopSecond = subscribeLiveEpoch(second);
    const before = getLiveEpoch();

    expect(refreshLiveData()).toBe(before + 1);
    expect(getLiveEpoch()).toBe(before + 1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopFirst();
    refreshLiveData();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    stopSecond();
  });

  it('un abonné qui se désabonne pendant la notification ne casse pas la boucle', () => {
    const calls: string[] = [];
    const stopA = subscribeLiveEpoch(() => {
      calls.push('a');
      stopB();
    });
    const stopB = subscribeLiveEpoch(() => calls.push('b'));
    refreshLiveData();
    expect(calls[0]).toBe('a');
    stopA();
  });

  it('l\'erreur d\'une requête est lue une seule fois', () => {
    expect(takeLiveError()).toBeNull();
    const failure = new Error('lecture impossible');
    recordLiveError(failure);
    expect(takeLiveError()).toBe(failure);
    expect(takeLiveError()).toBeNull();
  });
});
