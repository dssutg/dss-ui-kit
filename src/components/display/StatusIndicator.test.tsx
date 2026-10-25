// SPDX-License-Identifier: MIT
// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  STATUS_TONES,
  StatusIndicator,
  statusToneClasses,
} from '@/components/display/StatusIndicator';
import { render } from '@/util/testing/render';

describe('StatusIndicator', () => {
  it.each(STATUS_TONES)('renders the %s dot and text classes', async (tone) => {
    const { container } = await render(<StatusIndicator tone={tone} label="Label" />);

    const dot = container.querySelector('[aria-hidden="true"]');
    const text = container.querySelector('[aria-hidden="true"] + span');

    expect(dot?.className).toContain(statusToneClasses[tone].dot);
    expect(text?.className).toContain(statusToneClasses[tone].text);
  });

  it('renders the label it was given', async () => {
    const { findByText } = await render(<StatusIndicator tone="ok" label="Ready" />);

    expect(findByText('Ready')).toBeDefined();
  });

  it('merges the caller classes', async () => {
    const { container } = await render(
      <StatusIndicator tone="neutral" label="Label" className="uppercase" />,
    );

    const root = container.querySelector('span');

    expect(root?.className).toContain('inline-flex');
    expect(root?.className).toContain('uppercase');
  });

  it('hides the dot from the accessibility tree, because the label carries the meaning', async () => {
    const { container } = await render(<StatusIndicator tone="error" label="Failed" />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
