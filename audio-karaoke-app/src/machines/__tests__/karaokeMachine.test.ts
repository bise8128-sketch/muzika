import { createActor } from 'xstate';
import { karaokeMachine } from '../karaokeMachine';

describe('karaokeMachine', () => {
  it('should start in idle state', () => {
    const actor = createActor(karaokeMachine).start();
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('should transition to loading on LOAD event', () => {
    const actor = createActor(karaokeMachine).start();
    actor.send({ type: 'LOAD', id: 'test-song' });
    expect(actor.getSnapshot().value).toBe('loading');
    expect(actor.getSnapshot().context.songId).toBe('test-song');
  });

  it('should transition to ready on READY event from loading', () => {
    const actor = createActor(karaokeMachine).start();
    actor.send({ type: 'LOAD', id: 'test-song' });
    actor.send({ type: 'READY' });
    expect(actor.getSnapshot().value).toBe('ready');
  });

  it('should transition to playing on PLAY event from ready', () => {
    const actor = createActor(karaokeMachine).start();
    actor.send({ type: 'LOAD', id: 'test-song' });
    actor.send({ type: 'READY' });
    actor.send({ type: 'PLAY' });
    expect(actor.getSnapshot().value).toBe('playing');
  });

  it('should transition to paused on PAUSE event from playing', () => {
    const actor = createActor(karaokeMachine).start();
    actor.send({ type: 'LOAD', id: 'test-song' });
    actor.send({ type: 'READY' });
    actor.send({ type: 'PLAY' });
    actor.send({ type: 'PAUSE' });
    expect(actor.getSnapshot().value).toBe('paused');
  });

  it('should handle errors by returning to idle/ready', () => {
    const actor = createActor(karaokeMachine).start();
    actor.send({ type: 'LOAD', id: 'test-song' });
    actor.send({ type: 'ERROR', message: 'Failed to load' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.error).toBe('Failed to load');
  });
});
