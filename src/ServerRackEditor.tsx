// The editor for the CSV device database behind a server rack.
import type React from 'react';
import { useEffect, useState } from 'react';
import { groupArrayByProperty, removeDuplicateObjectsFromArray } from '@/lib/array';
import { parseCSV } from '@/lib/dsv';
import { downloadStringAsPlainTextFile, openFileDialog } from '@/lib/file';
import { clamp, cmp, naturalCmp } from '@/lib/math';
import { getListAsCountMap } from '@/lib/record';
import { useGranularEffect } from '@/lib/use_granular_effect';
import { useLocale } from '@/locale';
import type { RackPanelName } from '@/server_rack_types';
import { Button } from '@/ui/Button';
import { ButtonGroup } from '@/ui/ButtonGroup';
import { DropDownButton } from '@/ui/DropDownButton';
import type { DropDownMenuItem } from '@/ui/DropDownMenu';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { TextInput } from '@/ui/TextInput';
import { ToggleSwitch } from '@/ui/ToggleSwitch';
import { UploadConfig } from '@/ui/UploadConfig';

interface RackDeviceInfo {
  rackId: string;
  posLabel: string;
  rackDeviceType: string;
  rackDeviceSerialNumber: number;
}

interface PosLabelTableCellInfo {
  posLabel: string;
}

export interface ServerRackEditorProps {
  /**
   * Recognises the columns of a device database, so the editor can offer automatic detection
   * instead of asking the operator to map every column by hand. Without it the editor only reads
   * databases whose columns the operator has named themselves.
   */
  readonly columns?: RackDatabaseColumns | undefined;
  /**
   * Ready-made column mappings the operator can pick from, for the exports a caller knows about.
   * A template is a suggestion: whatever the operator has typed wins.
   */
  readonly aliasMapTemplates?: readonly RackDeviceAliasMap[] | undefined;
  /**
   * The name the editor offers for a downloaded rack configuration. A prop because the file name
   * ends up in the operator's downloads folder and the convention is the caller's.
   */
  readonly configFilename?: string | undefined;
}

/**
 * Edits the device database behind a rack: the two position-label tables, the list of devices read
 * from them, and the import of a CSV database.
 *
 * What the columns are called, and which column is which, belongs to whoever produces the database.
 * This editor takes that as {@link ServerRackEditorProps.columns} and
 * {@link ServerRackEditorProps.aliasMapTemplates} and does not guess otherwise.
 */
export function SeverRackEditor({
  columns,
  aliasMapTemplates = [],
  configFilename = 'rack_config.json',
}: ServerRackEditorProps = {}) {
  const { t } = useLocale();

  const [frontPosLabelTableRows, setFrontPosLabelTableRows] = useState<PosLabelTableCellInfo[][]>(
    newPosLabelTable(),
  );
  const [backPosLabelTableRows, setBackPosLabelTableRows] = useState<PosLabelTableCellInfo[][]>(
    newPosLabelTable(),
  );

  const [rackDevices, setRackDevices] = useState<RackDeviceInfo[]>([]);

  const [curConfigFilename, setCurConfigFilename] = useState(configFilename);

  const [rackId, setRackId] = useState('');

  const [rackPanel, setRackPanel] = useState<RackPanelName>('front');

  const [csvDBFilename, setCSVDBFilename] = useState('');

  const [importDBModalOpen, setImportDBModalOpen] = useState(false);

  // IMPORTANT: Assume valid CSV content, i.e., no validation
  function loadCSVDB(csv: string, dbFieldAliasMap: RackDeviceAliasMap | null) {
    const rows = parseCSV(csv);

    const parsedRecords = parseRows(rows, {
      databaseFieldAliasMap: dbFieldAliasMap,
      columns: columns ?? noDatabaseColumns,
    });

    const sortedRecords = parsedRecords.toSorted(
      (a, b) =>
        cmp(a.rackId, b.rackId) ||
        naturalCmp(a.posLabel, b.posLabel) ||
        cmp(a.rackDeviceType, b.rackDeviceType) ||
        cmp(a.rackDeviceSerialNumber, b.rackDeviceSerialNumber),
    );

    const uniqueRecords = removeDuplicateObjectsFromArray(sortedRecords);

    setRackDevices(uniqueRecords);
  }

  // IMPORTANT: Assume valid data, no validation
  function onLoadConfig() {
    openFileDialog(
      async (file) => {
        const data = JSON.parse(await file.text());
        setCurConfigFilename(file.name);
        setRackId((data.rackId ?? '').toString());
        setFrontPosLabelTableRows(data.frontPosLabelTableRows);
        setBackPosLabelTableRows(data.backPosLabelTableRows);
        setRackDevices(data.rackDevices);
        setCSVDBFilename((data.csvDatabaseFilename ?? '').toString());
      },
      { accept: '.json' },
    );
  }

  function onSaveConfig() {
    const data = {
      rackId,
      frontPosLabelTableRows,
      backPosLabelTableRows,
      rackDevices,
      csvDatabaseFilename: csvDBFilename,
    };

    const json = JSON.stringify(data);

    downloadStringAsPlainTextFile(curConfigFilename, json);
  }

  async function onImportCsvDatabase({
    databaseFile,
    databaseFieldAliasMap,
  }: {
    readonly databaseFile: File;
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
  }) {
    const csv = await databaseFile.text();

    setCSVDBFilename(databaseFile.name);
    loadCSVDB(csv, databaseFieldAliasMap);
  }

  function onImportDB() {
    setImportDBModalOpen(true);
  }

  const rackDevicesByPosLabelMap = groupArrayByProperty(rackDevices, (d) => d.posLabel);

  const labels = [
    ...frontPosLabelTableRows
      .map((row) => row.map((column) => column.posLabel).filter((label) => label !== ''))
      .flat(2),

    ...backPosLabelTableRows
      .map((row) => row.map((column) => column.posLabel).filter((label) => label !== ''))
      .flat(2),
  ];

  const usedPosLabels = new Set(labels);

  const posLabelCountMap = getListAsCountMap(labels, (item) => item);

  return (
    <div className="box-border flex h-screen w-screen flex-col gap-2 overflow-auto p-2">
      <div className="flex shrink-0 gap-2">
        <div className="bg-bpd flex flex-grow items-center gap-2 overflow-hidden rounded-lg p-2">
          <div className="truncate" title={curConfigFilename}>
            {curConfigFilename}
          </div>
          <IconButton
            icon="upload"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.loadConfig')}
            onClick={onLoadConfig}
          />
          <IconButton
            icon="save"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.saveConfig')}
            onClick={onSaveConfig}
          />
          <IconButton
            icon="server"
            iconClassName="size-5 fill-tpd"
            className="rounded-full p-2"
            bgClassName="hover:bg-bse"
            rippleColor="var(--color-ripple-icon-button)"
            title={t('RackDatabaseEditor.exportConfig')}
            onClick={() => {
              const filename = `${rackId}.json`;

              const frontSize = getPosLabelTableSize(frontPosLabelTableRows);
              const backSize = getPosLabelTableSize(backPosLabelTableRows);

              function buildDeviceFromCell(row: number, col: number, cell: PosLabelTableCellInfo) {
                const device = rackDevicesByPosLabelMap[cell.posLabel]?.[0];

                if (device === undefined) {
                  return null;
                }

                const pos = cell.posLabel;
                const type = device.rackDeviceType;
                const sn = device.rackDeviceSerialNumber;

                return { row, col, pos, type, sn };
              }

              function addCellDevice(
                devices: {
                  row: number;
                  col: number;
                  pos: string;
                  type: string;
                  sn: number;
                }[],
                row: number,
                col: number,
                cell: PosLabelTableCellInfo | undefined,
              ) {
                if (cell === undefined) {
                  return;
                }

                const device = buildDeviceFromCell(row, col, cell);
                if (device !== null) {
                  devices.push(device);
                }
              }

              function getFlatPanel(tableRows: readonly PosLabelTableCellInfo[][]) {
                const { rows, columns } = getPosLabelTableSize(tableRows);

                const devices: {
                  row: number;
                  col: number;
                  pos: string;
                  type: string;
                  sn: number;
                }[] = [];

                for (let row = 0; row < rows; row++) {
                  for (let col = 0; col < columns; col++) {
                    const cell = tableRows[row]?.[col];
                    addCellDevice(devices, row, col, cell);
                  }
                }

                return devices;
              }

              const json = JSON.stringify({
                GetServerRack: rackId,
                frontPanelRowCount: frontSize.rows,
                frontPanelColumnCount: frontSize.columns,
                backPanelRowCount: backSize.rows,
                backPanelColumnCount: backSize.columns,
                frontPanel: getFlatPanel(frontPosLabelTableRows),
                backPanel: getFlatPanel(backPosLabelTableRows),
              });

              downloadStringAsPlainTextFile(filename, json);
            }}
          />
        </div>
        <div className="bg-bpd flex shrink-0 items-center gap-2 rounded-lg p-2">
          <TextInput
            placeholder={t('RackDatabaseEditor.rackId')}
            value={rackId}
            onChange={(e) => setRackId(e.currentTarget.value)}
            onClearClick={() => setRackId('')}
            spellCheck={false}
          />
        </div>
        <div className="bg-bpd flex shrink-0 gap-2 rounded-lg p-2">
          <Button title={t('RackDatabaseEditor.importDatabase')} onClick={onImportDB} />
        </div>
      </div>
      <div className="flex flex-grow gap-2 overflow-hidden">
        <div className="bg-bpd flex flex-grow flex-col gap-2 overflow-hidden rounded-lg">
          <div className="mt-4 flex shrink-0 justify-center">
            <ButtonGroup
              itemId={rackPanel}
              items={[
                { id: 'front', title: t('ServerRack.panel.front') },
                { id: 'back', title: t('ServerRack.panel.back') },
              ]}
              onItemChange={setRackPanel}
            />
          </div>
          {rackPanel === 'front' ? (
            <PosLabelTable
              key="front"
              rows={frontPosLabelTableRows}
              setRows={setFrontPosLabelTableRows}
              posLabelCountMap={posLabelCountMap}
              rackDevicesByPosLabelMap={rackDevicesByPosLabelMap}
            />
          ) : (
            <PosLabelTable
              key="back"
              rows={backPosLabelTableRows}
              setRows={setBackPosLabelTableRows}
              posLabelCountMap={posLabelCountMap}
              rackDevicesByPosLabelMap={rackDevicesByPosLabelMap}
            />
          )}
        </div>
        <div className="bg-bpd flex w-[450px] shrink-0 flex-col overflow-hidden rounded-lg">
          <div className="shrink-0 p-2 text-center">
            {t('RackDatabaseEditor.databaseDevices', {
              count: rackDevices.length,
            })}
          </div>
          {csvDBFilename !== '' && (
            <div className="border-b-bsp shrink-0 truncate border-b-2 p-2" title={csvDBFilename}>
              <span className="font-bold">{t('RackDatabaseEditor.database')}</span>
              {csvDBFilename}
            </div>
          )}
          <div className="bg-bpd grid grid-cols-[repeat(4,auto)] gap-2 overflow-auto p-4">
            {rackDevices.map((rackDevice) => {
              const { posLabel, rackDeviceType, rackDeviceSerialNumber, rackId } = rackDevice;

              const title = t('RackDatabaseEditor.deviceRow', {
                posLabel,
                rackDeviceType,
                serialNumber: rackDeviceSerialNumber,
                rackId,
              });

              return (
                <div
                  key={JSON.stringify(rackDevice)}
                  className={`
              contents
              ${usedPosLabels.has(posLabel) ? 'text-tpd' : 'text-tpl'}
            `}
                  title={title}
                >
                  <div>{posLabel}</div>
                  <div>{rackDeviceType}</div>
                  <div>S/N {rackDeviceSerialNumber}</div>
                  {rackId !== '' ? (
                    <div>{t('RackDatabaseEditor.rackOf', { rackId })}</div>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ImportDatabaseModal
        open={importDBModalOpen}
        onOpenChange={setImportDBModalOpen}
        onImport={onImportCsvDatabase}
        aliasMapTemplates={aliasMapTemplates}
        templateLabel={(index) => t('RackDatabaseEditor.template', { index })}
      />
    </div>
  );
}

/**
 * Recognises the CSV columns of a device database.
 *
 * The header names in a device database belong to whoever produces the export, so guessing them is
 * the caller's decision: a predicate per field, given the normalised header as it appears in the
 * file. A field whose predicate never matches is simply not read, which is how a caller says a
 * database has no such column rather than this module guessing one.
 */
export interface RackDatabaseColumns {
  readonly matchRackId: (header: string) => boolean;
  readonly matchPosLabel: (header: string) => boolean;
  readonly matchDeviceType: (header: string) => boolean;
  readonly matchSerialNumber: (header: string) => boolean;
}

/** The detection used when the caller supplies no {@link RackDatabaseColumns}: match nothing. */
const noDatabaseColumns: RackDatabaseColumns = {
  matchRackId: () => false,
  matchPosLabel: () => false,
  matchDeviceType: () => false,
  matchSerialNumber: () => false,
};

function normalizeProp(property: string) {
  return property.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeVal(value: unknown) {
  return (value ?? '').toString().trim().replace(/\s+/g, ' ');
}

function normalizeRecord(record: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [normalizeProp(key), normalizeVal(value)]),
  );
}

function resolveFieldNames(
  record: Record<string, string>,
  {
    isAutoDetection,
    rackIdAlias,
    posLabelAlias,
    rackDeviceTypeAlias,
    rackDeviceSerialNumberAlias,
    columns,
  }: {
    readonly isAutoDetection: boolean;
    readonly rackIdAlias: string;
    readonly posLabelAlias: string;
    readonly rackDeviceTypeAlias: string;
    readonly rackDeviceSerialNumberAlias: string;
    readonly columns: RackDatabaseColumns;
  },
) {
  let rackIdFieldName = rackIdAlias;
  let posLabelFiledName = posLabelAlias;
  let rackDeviceTypeFieldName = rackDeviceTypeAlias;
  let rackDeviceSerialNumberFieldName = rackDeviceSerialNumberAlias;

  if (isAutoDetection) {
    rackIdFieldName = Object.keys(record).filter(columns.matchRackId)[0] ?? '';
    posLabelFiledName = Object.keys(record).filter(columns.matchPosLabel)[0] ?? '';
    rackDeviceTypeFieldName = Object.keys(record).filter(columns.matchDeviceType)[0] ?? '';
    rackDeviceSerialNumberFieldName =
      Object.keys(record).filter(columns.matchSerialNumber)[0] ?? '';
  }

  return {
    rackIdFieldName,
    posLabelFiledName,
    rackDeviceTypeFieldName,
    rackDeviceSerialNumberFieldName,
  };
}

function buildParsedRecord(
  record: Record<string, string>,
  fieldNames: {
    readonly rackIdFieldName: string;
    readonly posLabelFiledName: string;
    readonly rackDeviceTypeFieldName: string;
    readonly rackDeviceSerialNumberFieldName: string;
  },
) {
  const rackDeviceSerialNumber =
    record[fieldNames.rackDeviceSerialNumberFieldName] !== undefined
      ? Number(record[fieldNames.rackDeviceSerialNumberFieldName]) || 0
      : 0;

  return {
    rackId: record[fieldNames.rackIdFieldName] ?? '',
    posLabel: record[fieldNames.posLabelFiledName] ?? '',
    rackDeviceType: record[fieldNames.rackDeviceTypeFieldName] ?? '',
    rackDeviceSerialNumber,
  };
}

function isValidParsedRecord(parsedRecord: RackDeviceInfo) {
  return (
    parsedRecord.posLabel !== '' &&
    parsedRecord.posLabel !== '-' &&
    parsedRecord.rackDeviceType !== '' &&
    parsedRecord.rackDeviceType !== '-'
  );
}

function parseRows(
  rows: readonly string[][],
  {
    databaseFieldAliasMap,
    columns,
  }: {
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
    readonly columns: RackDatabaseColumns;
  },
) {
  const records = convertCsvRowsToObjectRecords(rows).map(normalizeRecord);

  const isAutoDetection = databaseFieldAliasMap === null;

  const rackIdAlias = normalizeProp(databaseFieldAliasMap?.rackIdAlias ?? '');
  const posLabelAlias = normalizeProp(databaseFieldAliasMap?.posLabelAlias ?? '');
  const rackDeviceTypeAlias = normalizeProp(databaseFieldAliasMap?.rackDeviceTypeAlias ?? '');
  const rackDeviceSerialNumberAlias = normalizeProp(
    databaseFieldAliasMap?.rackDeviceSerialNumberAlias ?? '',
  );

  const validRecords: RackDeviceInfo[] = [];

  for (const record of records) {
    const fieldNames = resolveFieldNames(record, {
      isAutoDetection,
      rackIdAlias,
      posLabelAlias,
      rackDeviceTypeAlias,
      rackDeviceSerialNumberAlias,
      columns,
    });

    if (
      fieldNames.posLabelFiledName === undefined ||
      fieldNames.rackDeviceTypeFieldName === undefined
    ) {
      continue;
    }

    const parsedRecord = buildParsedRecord(record, fieldNames);

    if (!isValidParsedRecord(parsedRecord)) {
      continue;
    }

    validRecords.push(parsedRecord);
  }

  return validRecords;
}

function convertCsvRowsToObjectRecords(rows: readonly string[][]) {
  let records: Record<string, string>[] = [];

  const [headerRow] = rows;

  if (!headerRow) {
    return [];
  }

  const bodyRows = rows.slice(1);

  for (const row of bodyRows) {
    const record: Record<string, string> = {};

    for (const [columnIndex, value] of row.entries()) {
      const property = headerRow[columnIndex];

      // A row longer than its header carries a cell with no property to record it under.
      if (property === undefined) {
        continue;
      }

      record[property] = value;
    }

    records = [...records, record];
  }

  return records;
}

interface RackDeviceAliasMap {
  rackIdAlias: string;
  posLabelAlias: string;
  rackDeviceTypeAlias: string;
  rackDeviceSerialNumberAlias: string;
}

function ImportDatabaseModal({
  open,
  onOpenChange,
  onImport,
  aliasMapTemplates,
  templateLabel,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * Ready-made column mappings to offer. Empty means the operator names every column, which is
   * the right default for a database whose headers this module has never seen.
   */
  readonly aliasMapTemplates: readonly RackDeviceAliasMap[];
  /**
   * Names the mapping chooser, and numbers the entries: a template is shown as
   * `${templateLabel(index + 1)}`.
   */
  readonly templateLabel: (index: number) => string;
  readonly onImport: ({
    databaseFile,
    databaseFieldAliasMap,
  }: {
    readonly databaseFile: File;
    readonly databaseFieldAliasMap: RackDeviceAliasMap | null;
  }) => void;
}) {
  const { t } = useLocale();

  const [dbFile, setDBFile] = useState<File | null>(null);

  const [autoFieldDetectionEnabled, setAutoFieldDetectionEnabled] = useState(true);

  const [dbFieldAliasMap, setDBFieldAliasMap] = useState<RackDeviceAliasMap>({
    rackIdAlias: '',
    posLabelAlias: '',
    rackDeviceTypeAlias: '',
    rackDeviceSerialNumberAlias: '',
  });

  const [fileUploaderKey, setFileUploaderKey] = useState(false);

  useEffect(() => {
    if (!open) {
      setFileUploaderKey((key) => !key);
      setDBFile(null);
    }
  }, [open]);

  const isAliasMapValid =
    autoFieldDetectionEnabled ||
    (dbFieldAliasMap.rackIdAlias !== '' &&
      dbFieldAliasMap.posLabelAlias !== '' &&
      dbFieldAliasMap.rackDeviceTypeAlias !== '' &&
      dbFieldAliasMap.rackDeviceSerialNumberAlias !== '' &&
      new Set([
        dbFieldAliasMap.rackIdAlias,
        dbFieldAliasMap.posLabelAlias,
        dbFieldAliasMap.rackDeviceTypeAlias,
        dbFieldAliasMap.rackDeviceSerialNumberAlias,
      ]).size === Object.keys(dbFieldAliasMap).length);

  const templateMenu = aliasMapTemplates.map<DropDownMenuItem>((t, i) => ({
    path: [i.toString()],
    title: templateLabel(i + 1),
    onSelect: () => setDBFieldAliasMap({ ...t }),
  }));

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('RackDatabaseEditor.importDatabase')}>
      <section className="border-t-bsp mt-4 flex flex-col gap-2 border-t-2 pt-4">
        <h2 className="text-center">{t('RackDatabaseEditor.databaseFields')}</h2>
        <ToggleSwitch
          label={t('RackDatabaseEditor.detectFields')}
          shouldLabelGrow
          enabled={autoFieldDetectionEnabled}
          onChange={() => setAutoFieldDetectionEnabled(!autoFieldDetectionEnabled)}
          style={{ marginTop: '1rem' }}
        />
        <div
          className={`
            relative flex flex-col gap-2 transition-[filter]
            ${autoFieldDetectionEnabled ? 'pointer-events-none brightness-75' : ''}
          `}
        >
          <div className="relative mx-auto">
            <DropDownButton
              variant="regular"
              triggerTitle={t('RackDatabaseEditor.chooseTemplate')}
              menu={templateMenu}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor="rack-database-editor-rackId">{t('RackDatabaseEditor.rackId')}</label>
            <TextInput
              id="rack-database-editor-rackId"
              value={dbFieldAliasMap.rackIdAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackIdAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackIdAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-posLabel">
              {t('RackDatabaseEditor.posLabel')}
            </label>
            <TextInput
              id="rack-database-editor-posLabel"
              value={dbFieldAliasMap.posLabelAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  posLabelAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  posLabelAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-deviceType">
              {t('RackDatabaseEditor.deviceType')}
            </label>
            <TextInput
              id="rack-database-editor-deviceType"
              value={dbFieldAliasMap.rackDeviceTypeAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceTypeAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceTypeAlias: '',
                }))
              }
            />
            <label htmlFor="rack-database-editor-serialNumber">
              {t('RackDatabaseEditor.serialNumber')}
            </label>
            <TextInput
              id="rack-database-editor-serialNumber"
              value={dbFieldAliasMap.rackDeviceSerialNumberAlias}
              onChange={(e) =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceSerialNumberAlias: e.currentTarget.value,
                }))
              }
              onClearClick={() =>
                setDBFieldAliasMap((map) => ({
                  ...map,
                  rackDeviceSerialNumberAlias: '',
                }))
              }
            />
          </div>
        </div>
      </section>
      <section className="border-t-bsp mt-4 flex flex-col items-center justify-center gap-2 border-t-2 pt-4">
        <h2>{t('RackDatabaseEditor.csvFile')}</h2>
        <UploadConfig
          key={Number(fileUploaderKey)}
          hint={t('RackDatabaseEditor.csvHint')}
          onlyDrop
          onFileChange={setDBFile}
          onFileUpload={async () => {}}
        />
      </section>
      <section className="border-t-bsp mt-4 flex justify-center border-t-2">
        <Button
          type={dbFile !== null && isAliasMapValid ? 'encouraging' : 'inactive'}
          title={t('RackDatabaseEditor.import')}
          onClick={() => {
            if (dbFile === null) {
              return;
            }

            onImport({
              databaseFile: dbFile,
              databaseFieldAliasMap: autoFieldDetectionEnabled ? null : dbFieldAliasMap,
            });

            onOpenChange(false);
          }}
          style={{
            marginLeft: 'auto',
            marginRight: 'auto',
            marginTop: '2rem',
          }}
        />
      </section>
    </Modal>
  );
}

const minRows = 0;
const maxRows = 10;
const minColumns = 0;
const maxColumns = 20;

const defaultRows = clamp(3, minRows, maxRows);
const defaultColumns = clamp(4, minColumns, maxColumns);

function PosLabelTable({
  rows,
  setRows,
  posLabelCountMap,
  rackDevicesByPosLabelMap,
}: {
  readonly rows: PosLabelTableCellInfo[][];
  readonly setRows: React.Dispatch<React.SetStateAction<PosLabelTableCellInfo[][]>>;
  readonly posLabelCountMap: Record<string, number>;
  readonly rackDevicesByPosLabelMap: Record<string, RackDeviceInfo[]>;
}) {
  const { t } = useLocale();

  const size = getPosLabelTableSize(rows);

  function dealWithPosLabelLayoutChange() {
    setLastFocusedPosLabelTableCell(null);
  }

  useGranularEffect(
    () => {
      dealWithPosLabelLayoutChange();
    },
    [size.rows, size.columns],
    [dealWithPosLabelLayoutChange],
  );

  const [lastFocusedPosLabelTableCell, setLastFocusedPosLabelTableCell] = useState<{
    row: number;
    column: number;
  } | null>(null);

  function onAddColumn() {
    if (size.rows === 0 || size.columns === 0) {
      setRows([[newPosLabelTableCell()]]);
    } else {
      setRows((rows) => rows.map((row) => [...row, newPosLabelTableCell()]));
    }

    dealWithPosLabelLayoutChange();
  }

  function onRemoveColumn() {
    if (lastFocusedPosLabelTableCell === null) {
      return;
    }

    const { column } = lastFocusedPosLabelTableCell;

    setRows((rows) => rows.map((row) => row.toSpliced(column, 1)));

    dealWithPosLabelLayoutChange();
  }

  function onAddRow() {
    if (size.rows === 0 || size.columns === 0) {
      setRows([[newPosLabelTableCell()]]);
    } else {
      setRows((rows) => [
        ...rows,
        Array.from({
          length: getPosLabelTableSize(rows).columns,
        }).map(newPosLabelTableCell),
      ]);
    }

    dealWithPosLabelLayoutChange();
  }

  function onRemoveRow() {
    if (lastFocusedPosLabelTableCell === null) {
      return;
    }

    const { row } = lastFocusedPosLabelTableCell;

    setRows((rows) => rows.toSpliced(row, 1));

    dealWithPosLabelLayoutChange();
  }

  const removeRowActive = size.rows > minRows && lastFocusedPosLabelTableCell !== null;

  const removeColumnActive = size.columns > minColumns && lastFocusedPosLabelTableCell !== null;

  return (
    <div className="flex flex-col gap-2 overflow-hidden p-2">
      <div className="flex shrink-0 gap-2">
        <IconButton
          icon="removeTableRow"
          iconClassName={`size-7 ${removeRowActive ? 'fill-tda' : 'fill-tpd'}`}
          className={`rounded-full p-2 ${!removeRowActive ? 'pointer-events-none' : ''}`}
          bgClassName={removeRowActive ? 'hover:bg-bse' : ''}
          rippleColor="var(--color-ripple-icon-button)"
          inactive={!removeRowActive}
          title={t('RackDatabaseEditor.removeRow')}
          onClick={onRemoveRow}
        />
        <IconButton
          icon="removeTableColumn"
          iconClassName={`
            size-7
            ${removeColumnActive ? 'fill-tda' : 'fill-tpd'}
          `}
          className={`rounded-full p-2 ${!removeRowActive ? 'pointer-events-none' : ''}`}
          bgClassName={removeRowActive ? 'hover:bg-bse' : ''}
          rippleColor="var(--color-ripple-icon-button)"
          inactive={!removeColumnActive}
          title={t('RackDatabaseEditor.removeColumn')}
          onClick={onRemoveColumn}
        />
      </div>
      <div className="flex w-full flex-grow flex-col gap-2 overflow-auto p-2">
        <div className="flex w-max flex-col gap-2">
          <div className="flex gap-2">
            <table className="w-max">
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((column, columnIndex) => {
                      const { posLabel } = column;

                      const isNonEmptyLabel = posLabel !== '';

                      const isDuplicateLabel =
                        isNonEmptyLabel && (posLabelCountMap[posLabel] ?? 0) > 1;

                      const rackDevicesWithLabel = rackDevicesByPosLabelMap[posLabel];

                      const isNonExistentLabel =
                        isNonEmptyLabel && rackDevicesWithLabel === undefined;

                      const isValidLabel = isDuplicateLabel || isNonExistentLabel;

                      return (
                        <td
                          key={columnIndex}
                          className="border-bsp relative h-6 w-20 truncate border-2"
                          title={(rackDevicesWithLabel ?? [])
                            .map(
                              (device) =>
                                `${posLabel}: ${device.rackDeviceType} (S/N ${device.rackDeviceSerialNumber})`,
                            )
                            .join('\n')}
                        >
                          {isValidLabel && (
                            <div className="border-tda pointer-events-none absolute left-0 top-0 h-full w-full border-2" />
                          )}
                          <input
                            value={posLabel}
                            onChange={(e) => {
                              const value = e.currentTarget.value.trim().replace(/\s+/g, ' ');

                              setRows((rows) => {
                                const cell = rows[rowIndex]?.[columnIndex];

                                if (cell === undefined) {
                                  return rows;
                                }

                                // The cell is copied as well as the row and the list. Copying only the
                                // two containers would leave the cell object shared with the state being
                                // replaced, so editing it would change the previous render's data too.
                                const newRows = [...rows];
                                const newRow = [...(rows[rowIndex] ?? [])];

                                newRow[columnIndex] = { ...cell, posLabel: value };
                                newRows[rowIndex] = newRow;

                                return newRows;
                              });
                            }}
                            onFocus={() =>
                              setLastFocusedPosLabelTableCell({
                                row: rowIndex,
                                column: columnIndex,
                              })
                            }
                            spellcheck={false}
                            className={'w-full border-none bg-transparent p-1 outline-none'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {size.columns < maxColumns && (
              <div className="my-auto">
                <IconButton
                  icon="plus"
                  iconClassName="size-5 fill-tpd"
                  className="rounded-full p-2"
                  bgClassName="hover:bg-bse"
                  rippleColor="var(--color-ripple-icon-button)"
                  title={t('RackDatabaseEditor.addColumn')}
                  onClick={onAddColumn}
                />
              </div>
            )}
          </div>
          {size.columns !== 0 && size.rows < maxRows && (
            <div className="mx-auto">
              <IconButton
                icon="plus"
                iconClassName="size-5 fill-tpd"
                className="rounded-full p-2"
                bgClassName="hover:bg-bse"
                rippleColor="var(--color-ripple-icon-button)"
                title={t('RackDatabaseEditor.addRow')}
                onClick={onAddRow}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function newPosLabelTableCell(): PosLabelTableCellInfo {
  return { posLabel: '' };
}

function newPosLabelTable() {
  return Array.from({ length: defaultRows }).map(() =>
    Array.from({ length: defaultColumns }).map(newPosLabelTableCell),
  );
}

function getPosLabelTableSize(rows: readonly PosLabelTableCellInfo[][]) {
  return { rows: rows.length, columns: rows[0]?.length ?? 0 };
}
