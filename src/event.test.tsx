// SPDX-License-Identifier: MIT
/**
 * The event bus is generic, so the tests exercise it through its own untyped surface and through the
 * typed wrappers a consumer's declaration merging enables. The typed functions are reached with a
 * narrowed function reference because the merged interface is empty here — the point of the empty
 * interface is that a consumer augments it, not the library.
 */
// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  emitEvent,
  emitTypedEvent,
  onEvent,
  useEvent,
  useTypedEvent,
  useTypedEventData,
} from '@/event';
import { act, render } from '@/util/testing/render';

/** The private event category name, repeated here because it is not exported. */
const CATEGORY = 'ui-kit:event';

/** The typed wrappers, narrowed so a test can call them without augmenting the consumer interface. */
const typedEmit = emitTypedEvent as unknown as (eventId: string, data: unknown) => void;
const typedUseEvent = useTypedEvent as unknown as (
  eventId: string,
  callback: (data: unknown) => void,
) => void;
const typedUseEventData = useTypedEventData as unknown as (eventId: string) => unknown;

function listen(): { readonly events: CustomEvent[]; readonly stop: () => void } {
  const events: CustomEvent[] = [];
  const listener = (event: Event): void => {
    events.push(event as CustomEvent);
  };

  window.addEventListener(CATEGORY, listener);

  return {
    events,
    stop: () => window.removeEventListener(CATEGORY, listener),
  };
}

describe('emitEvent', () => {
  it('carries the id and the payload', () => {
    const { events, stop } = listen();

    emitEvent('cart:changed', { itemCount: 3 });

    expect(events[0]?.detail).toEqual({ id: 'cart:changed', data: { itemCount: 3 } });

    stop();
  });

  it('omits the payload when none was given, so "no payload" is distinguishable from "never emitted"', () => {
    const { events, stop } = listen();

    emitEvent('heartbeat');

    expect(events[0]?.detail).toEqual({ id: 'heartbeat' });

    stop();
  });
});

describe('useEvent', () => {
  it('calls the callback for its own event and not for another', async () => {
    const callback = vi.fn();

    function Probe(): ReactNode {
      useEvent<{ value: number }>('mine', callback);
      return null;
    }

    await render(<Probe />);

    act(() => {
      emitEvent('theirs', { value: 1 });
    });
    act(() => {
      emitEvent('mine', { value: 2 });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ value: 2 });
  });

  it('keeps the latest callback without resubscribing', async () => {
    const first = vi.fn();
    const second = vi.fn();

    function Probe({ callback }: { readonly callback: (data: unknown) => void }): ReactNode {
      useEvent<unknown>('mine', callback);
      return null;
    }

    const { update } = await render(<Probe callback={first} />);

    await update(<Probe callback={second} />);

    act(() => {
      emitEvent('mine', 'payload');
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('payload');
  });
});

describe('onEvent', () => {
  it('fires once and unsubscribes itself', () => {
    const callback = vi.fn();

    onEvent('once', callback);

    emitEvent('other', 1);
    emitEvent('once', 2);
    emitEvent('once', 3);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(2);
  });
});

describe('typed events', () => {
  it('emitTypedEvent forwards to the bus', () => {
    const { events, stop } = listen();

    typedEmit('typed', { value: 7 });

    expect(events[0]?.detail).toEqual({ id: 'typed', data: { value: 7 } });

    stop();
  });

  it('useTypedEvent drops a payloadless emission', async () => {
    const callback = vi.fn();

    function Probe(): ReactNode {
      typedUseEvent('typed', callback);
      return null;
    }

    await render(<Probe />);

    act(() => {
      emitEvent('typed');
      emitEvent('typed', { value: 1 });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ value: 1 });
  });

  it('useTypedEventData renders the latest payload and ignores a payloadless emission', async () => {
    function Probe(): ReactNode {
      const data = typedUseEventData('typed');

      return <span>{data === null ? 'none' : JSON.stringify(data)}</span>;
    }

    const { findByText } = await render(<Probe />);

    expect(findByText('none')).toBeDefined();

    act(() => {
      emitEvent('typed');
    });

    expect(findByText('none')).toBeDefined();

    act(() => {
      emitEvent('typed', { value: 9 });
    });

    expect(findByText('{"value":9}')).toBeDefined();
  });
});
