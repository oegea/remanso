import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./engine', () => ({
  engine: { play: vi.fn(async () => {}), pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), stop: vi.fn(async () => {}), setVolume: vi.fn(), fadeOut: vi.fn() },
}));

import { player, elapsed, fmtElapsed } from './player';
import { engine } from './engine';

describe('reproductor', () => {
  beforeEach(async () => { vi.useRealTimers(); await player.stop(); player.setTimer(0); vi.clearAllMocks(); });
  it('arranca, pausa, reanuda y para, y sólo suena por un gesto explícito', async () => {
    expect(player.state.soundId).toBeNull();
    await player.play('rain_soft');
    expect(player.state).toMatchObject({ soundId: 'rain_soft', status: 'playing' });
    expect(engine.play).toHaveBeenCalledWith('rain_soft', player.state.volume);
    await player.pause();
    expect(player.state.status).toBe('paused');
    await player.resume();
    expect(player.state.status).toBe('playing');
    await player.stop();
    expect(player.state.soundId).toBeNull();
  });
  it('siguiente respeta el uso elegido', async () => {
    player.setUse('sleep');
    await player.play('white');
    await player.next();
    expect(player.state.soundId).not.toBe('white');
    player.setUse(null);
  });
  it('el temporizador programa el fundido y la parada', async () => {
    vi.useFakeTimers();
    await player.play('waves');
    player.setTimer(30);
    expect(player.state.endsAt).not.toBeNull();
    vi.advanceTimersByTime(30 * 60_000 - 25_000 + 10);
    expect(engine.fadeOut).toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(player.state.soundId).toBeNull();
    vi.useRealTimers();
  });
  it('cuenta el tiempo sonando y lo congela en pausa', async () => {
    vi.useFakeTimers();
    await player.play('fire');
    vi.advanceTimersByTime(65_000);
    expect(fmtElapsed(elapsed())).toBe('1:05');
    await player.pause();
    vi.advanceTimersByTime(30_000);
    expect(fmtElapsed(elapsed())).toBe('1:05');
    await player.resume();
    vi.advanceTimersByTime(3_600_000);
    expect(fmtElapsed(elapsed())).toBe('1:01:05');
    vi.useRealTimers();
  });
  it('el volumen se acota entre 0 y 1', () => {
    player.setVolume(1.7); expect(player.state.volume).toBe(1);
    player.setVolume(-1); expect(player.state.volume).toBe(0);
    player.setVolume(0.6);
  });
});
