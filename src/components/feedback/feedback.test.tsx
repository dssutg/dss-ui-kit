/**
 * The feedback group's contract, split the way the components are built: `Spinner`,
 * `ContinuousCircleSpinner`, `Ripple` and `ScrollProgressBar` are self-contained decoration that
 * must work without any provider around them; `DashedCircle` is the one feedback control that carries
 * an accessible name; and the `LogWidget` family is controlled — it reports play/pause and clear and
 * never holds output or playing state of its own. `CommandConsole` is the one group member with a shell
 * of its own: the commands are the caller's, and what the console owes them is a prompt, a history and
 * the two commands a shell cannot do without.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  CommandConsole,
  type CommandConsoleCommand,
  type CommandConsoleContext,
  type CommandConsoleProps,
} from '@/components/feedback/CommandConsole';
import { ContinuousCircleSpinner } from '@/components/feedback/ContinuousCircleSpinner';
import { DashedCircle } from '@/components/feedback/DashedCircle';
import { LogOutputTextArea } from '@/components/feedback/LogOutputTextArea';
import { LogWidget } from '@/components/feedback/LogWidget';
import { Ripple } from '@/components/feedback/Ripple';
import { ScrollProgressBar } from '@/components/feedback/ScrollProgressBar';
import { Spinner } from '@/components/feedback/Spinner';
import { act, click, render, type } from '@/util/testing/render';

describe('Spinner', () => {
  it('renders without a provider, a theme or a locale', async () => {
    const { find } = await render(<Spinner />);

    expect(find('div')).toBeDefined();
  });
});

describe('ContinuousCircleSpinner', () => {
  it('is indeterminate: it takes no percentage and only draws a rotating ring', async () => {
    const { container } = await render(<ContinuousCircleSpinner />);

    const spinner = container.querySelector('div');

    expect(spinner?.className).toContain('animate-spin');
    expect(spinner?.getAttribute('role')).toBeNull();
  });
});

describe('DashedCircle', () => {
  it('is named by its title rather than by its shape', async () => {
    const { container } = await render(<DashedCircle title="Connected" />);

    const svg = container.querySelector('svg');

    if (svg === null) {
      throw new Error('DashedCircle rendered no svg.');
    }

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Connected');
  });

  it('draws no ring while inactive', async () => {
    const { container } = await render(<DashedCircle active={false} title="Connected" />);

    expect(container.querySelector('animate')).toBeNull();
  });
});

describe('Ripple', () => {
  it('is decorative, so it takes no place in the accessibility tree', async () => {
    const { container } = await render(<Ripple color="#fff" />);

    expect(container.querySelector('span')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ScrollProgressBar', () => {
  it('renders the track it fills', async () => {
    const { container } = await render(<ScrollProgressBar />);

    expect(container.querySelectorAll('div').length).toBeGreaterThan(1);
  });
});

/**
 * A log output an operator reads while something streams: read-only so a caret cannot sit in it, and
 * wrapping only as asked, since a log the operator lines up by column breaks under soft wrapping.
 */
describe('LogOutputTextArea', () => {
  it('shows the output and refuses to be typed into', async () => {
    const { find } = await render(<LogOutputTextArea output={'first line\nsecond line'} />);

    const textarea = find<HTMLTextAreaElement>('textarea');

    expect(textarea.value).toBe('first line\nsecond line');
    expect(textarea.readOnly).toBe(true);
  });

  it('stops wrapping long lines only when asked', async () => {
    const { find, update } = await render(<LogOutputTextArea output="x" />);

    expect(find('textarea').className).not.toContain('whitespace-pre');

    await update(<LogOutputTextArea output="x" dontWrapLongLines />);

    expect(find('textarea').className).toContain('whitespace-pre');
  });
});

/**
 * The widget is controlled throughout: `playing` decides which action the button reports, and the
 * output is only ever displayed, never cleared by the widget itself.
 */
describe('LogWidget', () => {
  it('reports play or pause depending on what it is doing, rather than toggling itself', async () => {
    const onPlayClick = vi.fn();
    const onPauseClick = vi.fn();
    const { find, findByText, update } = await render(
      <LogWidget
        title="Output"
        playing
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    expect(findByText('Output')).toBeDefined();
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('ready');

    await click(find<HTMLButtonElement>('button'));

    expect(onPauseClick).toHaveBeenCalledTimes(1);
    expect(onPlayClick).not.toHaveBeenCalled();

    await update(
      <LogWidget
        title="Output"
        playing={false}
        output="ready"
        onPlayClick={onPlayClick}
        onPauseClick={onPauseClick}
        onClearClick={() => undefined}
      />,
    );

    await click(find<HTMLButtonElement>('button'));

    expect(onPlayClick).toHaveBeenCalledTimes(1);
  });

  it('reports a request to clear without clearing the output itself', async () => {
    const onClearClick = vi.fn();
    const { findAll, find } = await render(
      <LogWidget
        title="Output"
        playing={false}
        output="still here"
        onPlayClick={() => undefined}
        onPauseClick={() => undefined}
        onClearClick={onClearClick}
      />,
    );

    await click(findAll<HTMLButtonElement>('button')[1] as HTMLButtonElement);

    expect(onClearClick).toHaveBeenCalledTimes(1);
    expect(find<HTMLTextAreaElement>('textarea').value).toBe('still here');
  });
});

describe('CommandConsole', () => {
  /**
   * A console with a few commands of the caller's, the way an application would supply them: each one
   * says what it does and echoes what it was given.
   */
  const commands: Record<string, CommandConsoleCommand> = {
    echo: {
      about: 'Echo the arguments back',
      usage: ({ commandName }) => [`${commandName} <text>`],
      execute: ({ args, echo: echoFromCommand }) => {
        echoFromCommand(`echoed: ${args.slice(1).join(' ')}`);
      },
    },
    count: {
      about: 'Report how many lines have been run',
      execute: ({ history, echo: echoFromCommand }) => {
        echoFromCommand(`run before this one: ${history.length}`);
      },
    },
    rename: {
      about: 'Say something else',
      usage: ['rename <text>'],
      execute: ({ args, echo: echoFromCommand }) => {
        echoFromCommand(`renamed to: ${args.slice(1).join(' ')}`);
      },
    },
    secret: {
      about: 'Do something only a developer may',
      requiresDeveloper: true,
      execute: ({ echo: echoFromCommand }) => {
        echoFromCommand('the secret');
      },
    },
    quiet: {
      about: 'Do nothing anyone should see listed',
      hidden: true,
      execute: ({ echo: echoFromCommand }) => {
        echoFromCommand('quietly done');
      },
    },
  };

  /** A console with the caller's commands registered, plus whatever a test changes about it. */
  function console(props: Partial<CommandConsoleProps> = {}) {
    return <CommandConsole open onOpenChange={() => undefined} commands={commands} {...props} />;
  }

  /** The output pane, which is where everything a command said ends up. */
  function output() {
    return document.body.querySelector('textarea')?.value ?? '';
  }

  /** Types a line and presses Enter, which is the whole interaction. */
  async function run(line: string) {
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, line);
    pressKey(input, 'Enter');
  }

  /** Presses a key at the prompt, with a modifier where one is named. */
  function pressKey(input: HTMLInputElement, key: string, ctrlKey = false) {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { code: key, ctrlKey, bubbles: true }));
    });
  }

  it('renders nothing at all while closed', async () => {
    const { container } = await render(
      <CommandConsole open={false} onOpenChange={() => undefined} commands={commands} />,
    );

    expect(container.textContent).toBe('');
  });

  it('asks to close on Escape, because the caller owns what is open', async () => {
    const onOpenChange = vi.fn();
    await render(<CommandConsole open onOpenChange={onOpenChange} commands={commands} />);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('runs the command the caller registered and echoes what it said', async () => {
    await render(console());

    await run('echo hello');

    // The line is echoed before the output, because a console that ran something the operator cannot
    // see is a console they cannot trust.
    expect(output()).toBe('> echo hello\nechoed: hello');
  });

  it('reports a name it does not hold, rather than doing nothing', async () => {
    await render(console());

    await run('nope');

    expect(output()).toContain('nope');
  });

  it('lists what the caller registered, and not what it hid', async () => {
    await render(console());

    await run('help');

    const help = output();

    expect(help).toContain('echo');
    expect(help).toContain('Echo the arguments back');
    expect(help).not.toContain('quiet');
  });

  it('lists its own shortcuts, so a command that cannot be found is still usable', async () => {
    await render(console());

    await run('help');

    expect(output()).toContain('Ctrl+L');
  });

  it("prints one command's usage, under the name it was called by", async () => {
    await render(console());

    await run('help rename');

    expect(output()).toContain('rename <text>');
  });

  it('empties the output when the built-in clear command runs', async () => {
    await render(console());

    await run('echo hello');
    await run('clear');

    expect(output()).toBe('');
  });

  it("lets a caller's command take a built-in name, because the caller knows what the name means", async () => {
    await render(console({ commands: { clear: { about: 'Nothing', execute: () => undefined } } }));

    await run('clear');

    expect(output()).toBe('> clear');
  });

  it('refuses a developer-only command and does not list it, rather than failing in front of the operator', async () => {
    await render(console());

    await run('secret');
    await run('help');

    expect(output()).not.toContain('the secret');
    expect(output()).not.toContain('Do something only a developer may');
  });

  it('runs and lists a developer-only command once the caller grants the right', async () => {
    await render(console({ developerMode: true }));

    await run('secret');
    await run('help');

    expect(output()).toContain('the secret');
    expect(output()).toContain('secret');
  });

  it('remembers a line and recalls it, then comes back to what was being typed', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await run('echo one');
    await type(input, 'half-typed');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo one');

    pressKey(input, 'ArrowDown');
    expect(input.value).toBe('half-typed');
  });

  it('recalls the last line first, so a command run twice needs one key', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await run('echo one');
    await run('echo two');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo two');

    pressKey(input, 'ArrowUp');
    expect(input.value).toBe('echo one');
  });

  it('hands the history to a command, with the line about to run not yet in it', async () => {
    await render(console());

    await run('count');
    await run('echo one');
    await run('count');

    expect(output()).toContain('run before this one: 2');
  });

  it('remembers a line repeated in a row once, because that is one thing to recall', async () => {
    await render(console());

    await run('count');
    await run('count');
    await run('count');

    expect(output()).toContain('run before this one: 1');
  });

  it('runs an alias for the command it stands for, with its arguments in place', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ args, setAlias }: CommandConsoleContext) => {
        const name = args[1];

        if (name === undefined) {
          return;
        }

        setAlias(name, args.slice(2).join(' '));
      },
    };

    await render(
      <CommandConsole
        open
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias e echo $$');
    await run('e through the alias');

    expect(output()).toContain('echoed: through the alias');
  });

  it('never lets an alias shadow a command, because a name means one thing', async () => {
    const aliased: CommandConsoleCommand = {
      about: 'Set an alias',
      execute: ({ setAlias }: CommandConsoleContext) => {
        setAlias('echo', 'count');
      },
    };

    await render(
      <CommandConsole
        open
        onOpenChange={() => undefined}
        commands={{ ...commands, alias: aliased }}
      />,
    );

    await run('alias echo count');
    await run('echo hello');

    expect(output()).toContain('echoed: hello');
  });

  it('cuts a line at the console line length, because an unbroken line is unreadable', async () => {
    await render(
      <CommandConsole
        open
        onOpenChange={() => undefined}
        commands={commands}
        initialMaxLineLength={6}
      />,
    );

    await run('echo abcdefgh');

    expect(output()).toBe('> echo\nechoed');
  });

  it('keeps the newest output when there is more of it than the console holds', async () => {
    await render(
      <CommandConsole
        open
        onOpenChange={() => undefined}
        commands={commands}
        maxOutputLength={20}
      />,
    );

    await run('echo one');
    await run('echo two');

    expect(output()).toContain('echo two');
    expect(output().length).toBeLessThanOrEqual(20);
  });

  it('wraps long output unless the caller started it unwrapped', async () => {
    await render(console());

    expect(document.body.querySelector('textarea')?.className).not.toContain('whitespace-pre');

    await render(console({ initialWrapLines: false }));

    const textareas = [...document.body.querySelectorAll('textarea')];

    expect(textareas.at(-1)?.className).toContain('whitespace-pre');
  });

  it('clears the output on Ctrl+L, the way every log does', async () => {
    await render(console());

    await run('echo hello');
    pressKey(document.body.querySelector('input') as HTMLInputElement, 'KeyL', true);

    expect(output()).toBe('');
  });

  it('removes the text after the caret on Ctrl+K, and leaves the rest of the line', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'keep drop');
    input.setSelectionRange(4, 4);

    pressKey(input, 'KeyK', true);

    expect(input.value).toBe('keep');
  });

  it('removes the text before the caret on Ctrl+U, and leaves the rest of the line', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'keep drop');
    input.setSelectionRange(4, 4);

    pressKey(input, 'KeyU', true);

    expect(input.value).toBe(' drop');
  });

  it('leaves a key it does not bind to the browser', async () => {
    await render(console());
    const input = document.body.querySelector('input') as HTMLInputElement;

    await type(input, 'echo hello');

    let defaultPrevented = true;

    act(() => {
      const event = new KeyboardEvent('keydown', { code: 'KeyH', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      defaultPrevented = event.defaultPrevented;
    });

    expect(defaultPrevented).toBe(false);
  });
});
