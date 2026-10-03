import { useCallback } from 'react';
import { Button } from '@/components/buttons/Button';
import { IconButton } from '@/components/buttons/IconButton';
import { uuidv4 } from '@/lib/uuid';
import { useLocale } from '@/locale';
import { Accordion } from './Accordion';

/**
 * One row of an {@link EditableAccordionList}.
 *
 * `key` is generated when the row is added and never changes, so a row keeps its identity — and its
 * content, its input and its expansion — across a rename. `editing` and `expanded` are the row's own
 * state, reported to the caller with everything else because the list is the caller's data.
 */
export interface EditableAccordionListItem {
  key: string;
  name: string;
  editing: boolean;
  expanded: boolean;
}

/**
 * A list of named, expandable, renameable rows, which is the shape of any set the operator
 * maintains one thing at a time.
 *
 * It edits names and order and reports the whole list back; what a row means, and whether the names
 * have to be unique, are the caller's: `isItemNameValid` is asked per name and `errors` is rendered
 * as given. Adding a row generates its key and a name from `appendItemTitle`, so the caller does not
 * have to invent either.
 */
export function EditableAccordionList({
  items,
  onChange,
  isItemNameValid,
  errors,
  getItemContent,
  appendItemTitle,
  className,
  getFilteredItemName,
}: {
  readonly items: EditableAccordionListItem[];
  readonly onChange: (items: EditableAccordionListItem[]) => void;
  readonly isItemNameValid: (itemName: string) => boolean;
  readonly errors: string[];
  readonly getItemContent: (item: EditableAccordionListItem) => React.ReactNode;
  readonly appendItemTitle: string;
  readonly className?: string | undefined;
  readonly getFilteredItemName?: (name: string) => string;
}) {
  const { t } = useLocale();

  const appendItem = useCallback(() => {
    onChange([
      ...items,
      {
        key: uuidv4(),
        name: '',
        editing: true,
        expanded: false,
      },
    ]);
  }, [onChange, items]);

  const removeItem = useCallback(
    (itemKey: string) => {
      onChange(items.filter(({ key }) => key !== itemKey));
    },
    [onChange, items],
  );

  const modifyItem = useCallback(
    (itemKey: string, newItemState: EditableAccordionListItem) => {
      const index = items.findIndex((listItem) => listItem.key === itemKey);
      if (index >= 0) {
        const newItems = [...items];
        newItems[index] = newItemState;
        onChange(newItems);
      }
    },
    [onChange, items],
  );

  const tryRenameItem = useCallback(
    (item: EditableAccordionListItem) => {
      if (!isItemNameValid(item.name)) {
        return;
      }
      if (items.filter((listItem) => listItem.name === item.name).length > 1) {
        return;
      }
      modifyItem(item.key, { ...item, editing: false });
    },
    [modifyItem, items, isItemNameValid],
  );

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        {items.length === 0 && (
          <div className="p-2 text-tpd">{t('EditableAccordionList.empty')}</div>
        )}
        {items.map((item) => {
          const controls = (
            <div className="flex items-center gap-1">
              <IconButton
                icon="times"
                className="rounded-full p-2"
                bgClassName="hover:bg-bse"
                iconClassName="fill-tda size-3"
                rippleColor="var(--color-ripple-icon-button)"
                onClick={() => removeItem(item.key)}
                title={t('EditableAccordionList.removeItem')}
              />
              <IconButton
                icon="pencil"
                className="rounded-full p-2"
                bgClassName="hover:bg-bse"
                iconClassName="fill-tpd size-4"
                rippleColor="var(--color-ripple-icon-button)"
                onClick={() => modifyItem(item.key, { ...item, editing: true })}
                title={t('EditableAccordionList.modifyItem')}
              />
            </div>
          );

          return (
            <div key={item.key} className="flex gap-2">
              {item.editing ? (
                <>
                  {controls}
                  <input
                    type="text"
                    spellcheck={false}
                    className="w-full border-2 border-tno bg-bpl p-2"
                    value={item.name}
                    onInput={(e) => {
                      const { value } = e.currentTarget;

                      modifyItem(item.key, {
                        ...item,
                        name: getFilteredItemName ? getFilteredItemName(value) : value,
                      });
                    }}
                    onBlur={() => tryRenameItem(item)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') {
                        return;
                      }
                      tryRenameItem(item);
                    }}
                    autoFocus
                  />
                </>
              ) : (
                <Accordion
                  triggerTitle={item.name}
                  expanded={item.expanded}
                  onExpansionChange={(expanded: boolean) => {
                    modifyItem(item.key, { ...item, expanded });
                  }}
                  style={{ flexGrow: 1, overflow: 'hidden' }}
                  triggerClassName="hover:bg-bse bg-bpl ml-2 border-2 border-transparent"
                  contentClassName="ml-2 mt-4 border-l-2 border-l-bsp pl-2 overflow-auto"
                  beforeTriggerComponent={controls}
                  fixedSize={300}
                  getContentStyle={(expanded) => ({
                    overflow: 'auto',
                    height: expanded ? 'auto' : 0,
                  })}
                  forceMount={false}
                >
                  {item.expanded && getItemContent(item)}
                </Accordion>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col justify-center gap-2 p-2">
        <ul className="ml-8 list-disc text-tda">
          {errors.map((error: string, index: number) => (
            <li key={`${error}_${index}`}>{error}</li>
          ))}
        </ul>
        <div className="mx-auto mb-8">
          <Button icon={'plus'} title={appendItemTitle} onClick={appendItem} />
        </div>
      </div>
    </div>
  );
}
