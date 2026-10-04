import { useCallback, useMemo, useRef, useState } from 'react';
import { LogOutputTextArea } from '@/components/feedback/LogOutputTextArea';
import { type MessageKey, type MessageParameters, useLocale } from '@/locale';
import { maxInArray } from '@/util/array';
import { useGranularEffect } from '@/util/hooks/use_granular_effect';

/** Resolves a message of the library's catalogue, for the parts of the console an operator reads. */
type Translate = (key: MessageKey, parameters?: MessageParameters | null) => string;

/**
 * One command of the console: what it says about itself, and what it does when its name is typed.
 *
 * `about` is what `help` lists, so a command nobody could find by name is a command that should not be
 * in the console. It is one line: the listing is a column of names beside a column of sentences, and a
 * sentence that needs two of them belongs in `usage`.
 */
export interface CommandConsoleCommand {
  readonly about: string;
  /**
   * The lines `help <command>` prints for it.
   *
   * A function where the lines depend on the name the command was called by, which is what lets a
   * command's usage text read correctly under a name shorter than its own.
   */
  readonly usage?:
    | readonly string[]
    | ((context: { readonly commandName: string }) => readonly string[])
    | undefined;
  /** Kept out of the listing, for a command that is only reached by name. */
  readonly hidden?: boolean | undefined;
  /**
   * Refused unless the console was given `developerMode`, and marked as such in the listing.
   *
   * For a command that reaches into the application's insides rather than for its operator: a hidden
   * flag, a raw request, anything whose answer is not the operator's to read. The console grants no
   * right of its own — it is told whether the caller has it.
   */
  readonly requiresDeveloper?: boolean | undefined;
  readonly execute: (context: CommandConsoleContext) => void;
}

/**
 * What a command is given when it runs.
 *
 * Every command reads and writes the console through this and nothing else. There is no global state
 * for a command to reach into, so a command can be tested by handing it one of these and reading what
 * it echoed.
 */
export interface CommandConsoleContext {
  /** The line as it was entered, before an alias was expanded. */
  readonly command: string;
  /** The line split on whitespace, with the alias already expanded. */
  readonly args: readonly string[];
  /** Prints output, each line cut to the console's line length. */
  readonly echo: (text: string) => void;
  /** Prints this command's own usage, or the one line that says it has none. */
  readonly usage: () => void;
  readonly clearOutput: () => void;
  /** The lines entered before this one, oldest first. */
  readonly history: readonly string[];
  /** Every command by name, the built-in ones included, so a command can name another. */
  readonly commands: Readonly<Record<string, CommandConsoleCommand>>;
  readonly wrapLines: boolean;
  readonly setWrapLines: (wrap: boolean) => void;
  readonly maxLineLength: number;
  readonly setMaxLineLength: (length: number) => void;
  /** The aliases by name, each the line it stands for. */
  readonly aliases: Readonly<Record<string, string>>;
  /** Defines or replaces an alias; `undefined` removes it. */
  readonly setAlias: (name: string, command: string | undefined) => void;
  /** Whether the caller granted the console developer rights. */
  readonly developerMode: boolean;
}

/**
 * A key the prompt binds, and the line `help` prints for it.
 *
 * The label and the codes are separate because they answer different questions: a key cap is how a
 * shortcut is written down, a code is what a key press reports, and the Enter key is two codes and one
 * key cap.
 */
interface CommandConsoleShortcut {
  readonly label: string;
  /** `KeyboardEvent.code` values, or `Ctrl+<code>` for one that needs a modifier held. */
  readonly codes: readonly string[];
  readonly descriptionKey: MessageKey;
}

/**
 * Every key the prompt binds, in one table.
 *
 * One table because a listing of shortcuts that is written out separately from the bindings is a
 * listing that lies: the day a key is added, the help would not mention it. The key handler and the
 * `help` listing both read this.
 */
const SHORTCUTS: readonly CommandConsoleShortcut[] = [
  {
    label: 'Enter',
    codes: ['Enter', 'NumpadEnter'],
    descriptionKey: 'CommandConsole.shortcut.run',
  },
  {
    label: 'Arrow Up',
    codes: ['ArrowUp'],
    descriptionKey: 'CommandConsole.shortcut.previousCommand',
  },
  {
    label: 'Arrow Down',
    codes: ['ArrowDown'],
    descriptionKey: 'CommandConsole.shortcut.nextCommand',
  },
  { label: 'Ctrl+L', codes: ['Ctrl+KeyL'], descriptionKey: 'CommandConsole.shortcut.clearOutput' },
  { label: 'Ctrl+E', codes: ['Ctrl+KeyE'], descriptionKey: 'CommandConsole.shortcut.caretToEnd' },
  {
    label: 'Ctrl+U',
    codes: ['Ctrl+KeyU'],
    descriptionKey: 'CommandConsole.shortcut.removeBeforeCaret',
  },
  {
    label: 'Ctrl+K',
    codes: ['Ctrl+KeyK'],
    descriptionKey: 'CommandConsole.shortcut.removeAfterCaret',
  },
];

/** How a bound key acts: on the line, or on the element it was pressed in. */
type ShortcutAction = (event: React.KeyboardEvent<HTMLInputElement>) => void;

/**
 * The console's props, which is mostly the caller's shell: what is registered, what the operator is
 * allowed, and where the two settings that are otherwise held by a command start.
 */
export interface CommandConsoleProps {
  /** Whether the console is on screen. Nothing is rendered while it is closed. */
  readonly open: boolean;
  /** Reports a request to open or close it, from Escape and from the caller. Never changes it itself. */
  readonly onOpenChange: (open: boolean) => void;
  /** The commands to offer, by name. A name here is a name the console will run. */
  readonly commands?: Readonly<Record<string, CommandConsoleCommand>> | undefined;
  /** Whether the operator may run the commands that asked for `requiresDeveloper`. */
  readonly developerMode?: boolean | undefined;
  /** Where line wrapping starts. A command may change it, so this is not a setting the console holds. */
  readonly initialWrapLines?: boolean | undefined;
  /** Where the line length starts. A command may change it, so this is not a setting the console holds. */
  readonly initialMaxLineLength?: number | undefined;
  /** How much output is kept. The oldest goes first: a console that only grows will stop rendering. */
  readonly maxOutputLength?: number | undefined;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}

/**
 * A command console: a prompt, a history, and the output of whatever was typed at it.
 *
 * The commands are the caller's, which is the whole point: a console that shipped a set of its own
 * would have to know what the application is, and this library does not. Two are built in, because a
 * shell without them is not a shell — `help`, which lists what is there, and `clear`, which empties the
 * output. A caller who wants one of those names for a command of their own passes it, and theirs is the
 * one that runs.
 *
 * The history is kept in the component and not in storage, so it survives the console being closed and
 * reopened but not a reload. That is a deliberate default: an operator's shell history is often
 * something they would rather not leave behind on a shared machine, and a caller who wants it kept
 * reads {@link CommandConsoleContext.history} and writes it where they keep things.
 *
 * A command is one line. There is no sub-prompt and nothing carried from one line to the next but the
 * alias table: a command that needs a sequence keeps it in the state its own closure already holds, and
 * takes the next value as an argument.
 *
 * `open` is the caller's, for the same reason as everywhere else in the library — a console is opened by
 * a key press the caller binds and closed by whatever the operator does next, and only the caller knows
 * which of those should take the keyboard back. Nothing is rendered while it is closed; the history is
 * still there when it opens again.
 */
export function CommandConsole({
  open,
  onOpenChange,
  commands,
  developerMode = false,
  initialWrapLines = true,
  initialMaxLineLength = 255,
  maxOutputLength = 10_000,
  className,
  style,
}: CommandConsoleProps) {
  const { t } = useLocale();

  const [output, setOutput] = useState('');
  const [wrapLines, setWrapLines] = useState(initialWrapLines);
  const [maxLineLength, setMaxLineLength] = useState(initialMaxLineLength);
  const [aliases, setAliases] = useState<Readonly<Record<string, string>>>({});

  const { lines, inputValue, setInput, recallPrevious, recallNext, remember } = useCommandHistory();

  const inputRef = useRef<HTMLInputElement>(null);

  const echo = useCallback(
    (text: string) => {
      const visibleText = text
        .split('\n')
        .map((line) => line.slice(0, maxLineLength))
        .join('\n');

      setOutput((previousOutput) => {
        const appended = previousOutput === '' ? visibleText : `${previousOutput}\n${visibleText}`;

        return appended.slice(-maxOutputLength);
      });
    },
    [maxLineLength, maxOutputLength],
  );

  const clearOutput = useCallback(() => {
    setOutput('');
  }, []);

  const setAlias = useCallback((name: string, command: string | undefined) => {
    setAliases((previousAliases) => {
      const next = { ...previousAliases };

      if (command === undefined) {
        delete next[name];
      } else {
        next[name] = command;
      }

      return next;
    });
  }, []);

  const commandMap = useMemo(() => ({ ...builtInCommands(t), ...commands }), [t, commands]);

  const execute = useCallback(
    (line: string) => {
      const entered = line.trim();
      const expanded = expandAlias(entered, aliases, commandMap);
      const args = expanded.split(/\s+/);
      const commandName = args[0] ?? '';

      if (commandName === '') {
        return;
      }

      const command = commandMap[commandName];

      if (command === undefined) {
        echo(t('CommandConsole.error.badCommand', { commandName }));

        return;
      }

      if (command.requiresDeveloper === true && !developerMode) {
        echo(t('CommandConsole.error.developerOnly', { commandName }));

        return;
      }

      command.execute({
        command: entered,
        args,
        echo,
        usage: () => {
          echo(usageOf(command, commandName, t));
        },
        clearOutput,
        history: lines,
        commands: commandMap,
        wrapLines,
        setWrapLines,
        maxLineLength,
        setMaxLineLength,
        aliases,
        setAlias,
        developerMode,
      });
    },
    [
      aliases,
      clearOutput,
      commandMap,
      developerMode,
      echo,
      lines,
      maxLineLength,
      setAlias,
      t,
      wrapLines,
    ],
  );

  const run = useCallback(
    (line: string) => {
      if (line.trim() === '') {
        return;
      }

      echo(`> ${line}`);
      remember(line);
      execute(line);
    },
    [echo, execute, remember],
  );

  const shortcuts = useMemo<Readonly<Record<string, ShortcutAction>>>(
    () => ({
      Enter: (event) => {
        run(event.currentTarget.value);
      },
      NumpadEnter: (event) => {
        run(event.currentTarget.value);
      },
      ArrowUp: recallPrevious,
      ArrowDown: recallNext,
      'Ctrl+KeyL': () => {
        clearOutput();
      },
      'Ctrl+KeyE': (event) => {
        const input = event.currentTarget;
        input.setSelectionRange(input.value.length, input.value.length);
        input.focus();
      },
      'Ctrl+KeyU': (event) => {
        const input = event.currentTarget;
        const text = input.value.slice(Math.max(0, input.selectionEnd ?? 0));

        // The element's own value is set as well as the state: a controlled input keeps what it was
        // typed until something re-renders it, and the caret would stay where it was.
        input.value = text;
        input.setSelectionRange(0, 0);
        setInput(text);
      },
      'Ctrl+KeyK': (event) => {
        const input = event.currentTarget;
        setInput(input.value.slice(0, Math.max(0, input.selectionStart ?? 0)));
      },
    }),
    [clearOutput, recallNext, recallPrevious, run, setInput],
  );

  useGranularEffect(
    () => {
      if (!open) {
        return undefined;
      }

      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      }

      window.addEventListener('keydown', handleKeyDown);
      inputRef.current?.focus();

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    },
    [open],
    [onOpenChange],
  );

  if (!open) {
    return null;
  }

  return (
    <div className={`bg-bpd flex flex-col gap-2 overflow-auto ${className ?? ''}`} style={style}>
      <LogOutputTextArea output={output} dontWrapLongLines={!wrapLines} shouldScrollToEndOnUpdate />
      <div className="relative">
        <span className="before:text-tpd before:absolute before:left-2 before:top-1/2 before:-translate-y-1/2 before:content-['>']">
          <input
            ref={inputRef}
            type="text"
            placeholder={t('CommandConsole.inputHint')}
            value={inputValue}
            className="bg-bpd text-tpl flex w-full appearance-none gap-1 rounded-2xl p-3 pl-6 font-mono outline-none"
            onInput={(event) => {
              setInput(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              runBoundShortcut(event, shortcuts);
            }}
          />
        </span>
      </div>
    </div>
  );
}

/**
 * The command history, as the three things it is: what was run, what is being typed now, and where in
 * what was run the typing has walked to.
 *
 * `recalledFrom` is `null` while the draft is being edited and a number once a line from the history
 * has been recalled into it, which is what lets `ArrowDown` off the last recalled line come back to the
 * draft rather than to nothing. A recalled line the operator goes on to edit is remembered as edited, and
 * recalling past it does not keep the edit: a history that held every intermediate edit of every
 * recalled line would be one nobody could read.
 *
 * A line identical to the one before it is not remembered twice, because pressing `ArrowUp` and `Enter`
 * is how an operator re-runs a command, and a history of that is mostly one command repeated.
 */
function useCommandHistory() {
  const [lines, setLines] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState('');
  const [recalledFrom, setRecalledFrom] = useState<number | null>(null);

  const setInput = useCallback((value: string) => {
    setDraft(value);
    setRecalledFrom(null);
  }, []);

  const recallPrevious = useCallback(() => {
    setRecalledFrom((current) => {
      if (lines.length === 0) {
        return null;
      }

      return current === null ? lines.length - 1 : Math.max(0, current - 1);
    });
  }, [lines]);

  const recallNext = useCallback(() => {
    setRecalledFrom((current) => {
      if (current === null) {
        return null;
      }

      return current >= lines.length - 1 ? null : current + 1;
    });
  }, [lines]);

  const remember = useCallback((line: string) => {
    setLines((previousLines) => {
      const lastLine = previousLines[previousLines.length - 1];

      return lastLine === line ? previousLines : [...previousLines, line];
    });
    setDraft('');
    setRecalledFrom(null);
  }, []);

  return {
    lines,
    inputValue: recalledFrom === null ? draft : (lines[recalledFrom] ?? ''),
    setInput,
    recallPrevious,
    recallNext,
    remember,
  };
}

/**
 * Runs the action bound to a key, if there is one, and stops the key going anywhere else.
 *
 * A bound key has `preventDefault` called on it, because the browser's own meaning for `Enter` in a text
 * field is to submit a form and for the rest is to do nothing: a console that let `ArrowUp` scroll the
 * page behind it would fight whatever the operator is looking at. An unbound key is left alone, so the
 * usual editing keys still work.
 */
function runBoundShortcut(
  event: React.KeyboardEvent<HTMLInputElement>,
  shortcuts: Readonly<Record<string, ShortcutAction>>,
): void {
  const withControl = `Ctrl+${event.code}`;
  const action =
    event.ctrlKey && shortcuts[withControl] !== undefined
      ? shortcuts[withControl]
      : shortcuts[event.code];

  if (action === undefined) {
    return;
  }

  event.preventDefault();
  action(event);
}

/** The lines a command prints its own usage as, or the one line that says it has none. */
function usageOf(command: CommandConsoleCommand, commandName: string, t: Translate): string {
  const usage = resolveUsage(command, commandName);

  if (usage === undefined || usage.length === 0) {
    return t('CommandConsole.error.noUsage', { commandName });
  }

  return `usage: ${usage.join('\n       ')}`;
}

/** A command's usage lines, resolved from whichever of the two forms it declared. */
function resolveUsage(
  command: CommandConsoleCommand,
  commandName: string,
): readonly string[] | undefined {
  const { usage } = command;

  if (usage === undefined) {
    return undefined;
  }

  return typeof usage === 'function' ? usage({ commandName }) : usage;
}

/**
 * The line a command name stands for, or the line itself when the name is not an alias.
 *
 * An alias never shadows a command of the same name, because a console whose behaviour depends on what
 * was typed earlier in the session is not one an operator can predict.
 *
 * `$$` is where the arguments of the aliased command go. An alias without `$$` has them appended, so an
 * alias can both stand for a command that takes arguments and stand for one that takes none.
 */
function expandAlias(
  line: string,
  aliases: Readonly<Record<string, string>>,
  commands: Readonly<Record<string, CommandConsoleCommand>>,
): string {
  const [commandName, ...args] = line.split(/\s+/);

  if (commandName === undefined) {
    return line;
  }

  const aliasedLine = aliases[commandName];

  if (aliasedLine === undefined || commands[commandName] !== undefined) {
    return line;
  }

  const argumentsText = args.join(' ');

  return aliasedLine.includes('$$')
    ? aliasedLine.replace(/\$\$/g, argumentsText)
    : `${aliasedLine} ${argumentsText}`.trim();
}

/**
 * The commands every shell has.
 *
 * `help` lists the commands and the keys, because a console whose commands cannot be discovered is a
 * console nobody types into. Both take their text from the catalogue: it is read by an operator, and the
 * library renders no text of its own. A command listed as developer-only is one the caller has not
 * granted, so it is not listed at all — the operator cannot run it, and naming it would be an
 * invitation that always fails.
 */
function builtInCommands(t: Translate): Record<string, CommandConsoleCommand> {
  return {
    help: {
      about: t('CommandConsole.help.about'),
      usage: () => [t('CommandConsole.help.usage')],
      execute: ({ args, echo: echoFromCommand, usage, commands, developerMode }) => {
        if (args.length > 1) {
          const commandName = args[1] ?? '';
          const command = commands[commandName];

          if (command === undefined) {
            echoFromCommand(t('CommandConsole.error.badCommand', { commandName }));

            return;
          }

          echoFromCommand(usageOf(command, commandName, t));

          return;
        }

        usage();

        echoFromCommand(
          [
            ...commandListings(commands, developerMode, t),
            '',
            t('CommandConsole.help.hotKeys'),
            ...SHORTCUTS.map((shortcut) => `\t${shortcut.label} - ${t(shortcut.descriptionKey)}`),
          ].join('\n'),
        );
      },
    },

    clear: {
      about: t('CommandConsole.clear.about'),
      execute: ({ clearOutput: clearFromCommand }) => {
        clearFromCommand();
      },
    },
  };
}

/** The commands as `help` lists them, one per line, aligned on the longest name. */
function commandListings(
  commands: Readonly<Record<string, CommandConsoleCommand>>,
  developerMode: boolean,
  t: Translate,
): string[] {
  const rows = Object.entries(commands)
    .filter(([, command]) => command.hidden !== true)
    .filter(([, command]) => developerMode || command.requiresDeveloper !== true)
    .map(([commandName, command]) => ({
      commandName,
      about:
        command.requiresDeveloper === true
          ? `${command.about} ${t('CommandConsole.help.developerOnly')}`
          : command.about,
    }));

  const nameColumnWidth = maxInArray(rows.map((row) => row.commandName.length));

  return rows.map((row) => `\t${row.commandName.padEnd(nameColumnWidth)} - ${row.about}`);
}
