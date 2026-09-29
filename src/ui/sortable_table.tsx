import { useCallback, useMemo, useState } from "react";
import { useForceUpdate } from "@/lib/use_force_update";
import { useTimeout } from "@/lib/use_timeout";
import { useLocale } from "@/locale";
import { Icon } from "./icon";
import {
	type VirtualizedListRowRendererProps,
	useVirtualizedList,
} from "./list";
import { Ripple } from "./ripple";

export type SortableTableComparatorFunction<T> = (
	a: SortableTableRowDescriptor<T>,
	b: SortableTableRowDescriptor<T>,
) => number;

export type SortableTableColumnComparatorTable<T, C extends string> = Readonly<
	Record<C, SortableTableComparatorFunction<T>>
>;

export type SortableTableHeaderColumn<C extends string> = Readonly<{
	id: C;
	title: string;
	width: number;
	minWidth?: number;
	style?: React.CSSProperties;
}>;

export type SortableTableCellDescriptor<C extends string> = Readonly<{
	columnId: C;
	component: React.ReactNode;
}>;

export type SortableTableRowDescriptor<T> = Readonly<{
	id: string;
	data: T;
}>;

export type SortableTableCellRendererContext<T, C extends string> = Readonly<{
	row: SortableTableRowDescriptor<T>;
	data: T;
	rowIndex: number;
	columnId: C;
	columnIndex: number;
	columnWidth: number;
}>;

export type SortableTableCellRenderer<T, C extends string> = (
	context: SortableTableCellRendererContext<T, C>,
) => React.ReactNode;

export type SortableTableColumnRenderMap<T, C extends string> = Readonly<
	Record<C, SortableTableCellRenderer<T, C>>
>;

export type SortableTableDescriptor<T, C extends string> = Readonly<{
	headerColumns: SortableTableHeaderColumn<C>[];
	rows: SortableTableRowDescriptor<T>[];
	headerRowHeight: number;
	rowHeight: number;
	cellRenderer: SortableTableCellRenderer<T, C>;
	columnComparators: SortableTableColumnComparatorTable<T, C>;
	onRowClick?: ({
		event,
		row,
		rowIndex,
	}: {
		event: MouseEvent;
		row: SortableTableRowDescriptor<T>;
		rowIndex: number;
	}) => void;
	getRowStyle?: ({
		row,
		rowIndex,
	}: {
		row: SortableTableRowDescriptor<T>;
		rowIndex: number;
	}) => React.CSSProperties;
}>;

export function makeSortableTableCellRenderer<T, C extends string>(
	columnMap: SortableTableColumnRenderMap<T, C>,
) {
	return (context: SortableTableCellRendererContext<T, C>) =>
		columnMap[context.columnId]?.(context);
}

export function SortableTable<T, C extends string>({
	descriptor,
	sortColumnId,
	reversedSort = false,
	className,
	style,
	rowStyle,
	tableRef,
}: {
	readonly descriptor: Readonly<SortableTableDescriptor<T, C>>;
	readonly sortColumnId?: C;
	readonly reversedSort?: boolean;
	readonly rowListOverScanCount?: number;
	readonly style?: React.CSSProperties;
	readonly className?: string;
	readonly rowStyle?: React.CSSProperties;
	readonly tableRef?: React.MutableRefObject<HTMLTableSectionElement | null>;
}) {
	const { t } = useLocale();

	const [isResizing, setIsResizing] = useState(false);
	const [currentSortColumnId, setCurrentSortColumnId] = useState(
		sortColumnId ?? descriptor.headerColumns[0]!.id,
	);
	const [currentReversedSort, setCurrentReversedSort] = useState(reversedSort);

	const [columnWidths, setColumnWidths] = useState<number[]>(() =>
		descriptor.headerColumns.map((column) => column.width),
	);

	const getColumnMinWidth = useCallback(
		(columnIndex: number) => {
			return descriptor.headerColumns[columnIndex]?.minWidth ?? 24;
		},
		[descriptor.headerColumns],
	);

	const getNewColumnWidth = useCallback(
		(columnWidth: number, columnIndex: number, movementX: number) => {
			return Math.max(getColumnMinWidth(columnIndex), columnWidth + movementX);
		},
		[getColumnMinWidth],
	);

	const resizeColumn = useCallback(
		(columnIndex: number, movementX: number) => {
			setColumnWidths((widths: number[]) => {
				const newWidths = [...widths];

				newWidths[columnIndex] = getNewColumnWidth(
					newWidths[columnIndex] ?? 0,
					columnIndex,
					movementX,
				);

				return newWidths;
			});
		},
		[getNewColumnWidth],
	);

	const { startIndex, endIndex, containerRef, getItemStyle } =
		useVirtualizedList({
			itemCount: descriptor.rows.length,
			itemSize: descriptor.rowHeight,
			overScanCount: 10,
			ref: tableRef,
		});

	const forceUpdate = useForceUpdate();

	// Make sure references get propagated to hooks
	useTimeout(forceUpdate, 0);

	const columnComparators = descriptor.columnComparators;

	const orderedColumnComparators = useMemo(() => {
		return Object.values({
			...(columnComparators[currentSortColumnId] !== undefined && {
				[currentSortColumnId]: columnComparators[currentSortColumnId],
			}),
			...columnComparators,
		});
	}, [columnComparators, currentSortColumnId]);

	const rows = descriptor.rows;

	const sortedRows = useMemo(() => {
		return rows.toSorted((a, b) => {
			for (const comparator of orderedColumnComparators) {
				const comparisonResult = comparator(a, b);

				if (comparisonResult !== 0) {
					if (currentReversedSort) {
						return -comparisonResult;
					}
					return comparisonResult;
				}
			}

			return 0;
		});
	}, [rows, orderedColumnComparators, currentReversedSort]);

	const rowRenderer = useCallback(
		({ index, style }: VirtualizedListRowRendererProps) => {
			const row = sortedRows[index];

			if (!row) {
				return null;
			}

			return (
				<SortableTableRow
					key={row.id}
					descriptor={descriptor}
					columnWidths={columnWidths}
					row={row}
					rowIndex={index}
					style={{ ...style, ...rowStyle }}
				/>
			);
		},
		[sortedRows, descriptor, columnWidths, rowStyle],
	);

	const totalRowListHeight = descriptor.rows.length * descriptor.rowHeight;

	return (
		<div
			ref={containerRef}
			className={`relative flex flex-col overflow-auto ${className}`}
			style={style}
		>
			{
				// CSS Hacks:
				//
				// - https://stackoverflow.com/questions/3215553/make-a-div-fill-an-entire-table-cell
				// - https://stackoverflow.com/questions/54044479/table-with-sticky-header-and-resizable-columns-without-using-jquery
				// - https://stackoverflow.com/questions/41882616/why-border-is-not-visible-with-position-sticky-when-background-color-exists
				//
				// height: 1px must be applied to <table> tag, not <tr>, <th>, <td> to make it work in both Chrome and Firefox
			}
			<table className="relative h-[1px]">
				{descriptor.rows.length > 0 ? (
					<tbody
						className="relative overflow-hidden"
						style={{ height: totalRowListHeight }}
					>
						{Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
							const index = startIndex + offset;

							return rowRenderer({ index, style: getItemStyle(index) });
						})}
					</tbody>
				) : (
					<tbody>
						<tr>
							<td
								className="text-tpd p-4"
								colSpan={descriptor.headerColumns.length}
							>
								{t("SortableTable.emptyList")}
							</td>
						</tr>
					</tbody>
				)}
				{
					// NOTE: <thead> is after <tbody> because <thead>'s z-index must be
					// greater than <tbody>'s z-index so that <thead> is rendered on top of
					// <tbody> when the user scrolls the table.
				}
				<thead>
					<tr className="relative">
						{descriptor.headerColumns.map((column, index) => (
							<th
								key={column.id}
								className="border-tpl bg-bpd shadow-tpl sticky top-0 box-border select-none border-r-2 pb-1 font-normal shadow-[inset_0px_-2px_0px_0px] last:border-r-0"
								style={{
									...(index !== descriptor.headerColumns.length - 1
										? {
												width: columnWidths[index],
												minWidth: columnWidths[index],
												maxWidth: columnWidths[index],
												height: descriptor.headerRowHeight,
											}
										: {
												minWidth: columnWidths[index],
												width: "100%",
												height: descriptor.headerRowHeight,
											}),
									...column.style,
								}}
							>
								<div
									className="hover:bg-bse relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden px-2 py-1"
									onClick={() => {
										if (isResizing) {
											return;
										}

										if (currentSortColumnId === column.id) {
											setCurrentReversedSort((reversed) => !reversed);

											return;
										}

										setCurrentSortColumnId(column.id);
										setCurrentReversedSort(false);
									}}
								>
									{!isResizing && <Ripple color="var(--color-ripple-button)" />}
									<div className="flex w-full items-center gap-1">
										<div className="flex-grow text-center">{column.title}</div>
										<Icon
											name="triangleDown"
											style={{
												fill: "var(--color-tpd)",
												width: "1rem",
												height: "1rem",
												flexShrink: 0,
												...(currentReversedSort && {
													transform: "rotate(180deg)",
												}),
												...(currentSortColumnId !== column.id && {
													opacity: 0,
													pointerEvents: "none",
												}),
											}}
										/>
									</div>
								</div>
								{index !== descriptor.headerColumns.length - 1 && (
									<>
										<div
											className="bg-tpl absolute top-0 h-full w-[5px]"
											style={{ right: "-0.3rem" }}
										/>
										<ColumnResizer
											onResize={(movementX) => {
												const headerColumn = descriptor.headerColumns[index];

												if (headerColumn === undefined) {
													return;
												}

												resizeColumn(index, movementX);
												setIsResizing(true);
											}}
											onResizeDone={() =>
												setTimeout(() => setIsResizing(false), 100)
											}
											style={{
												// Set the resizer height to the viewport height.
												// Since the resizer is hidden on overflow-y, there's no need to match
												// the height of the visible table area exactly; the resizer height can be much greater.
												// This simplifies calculations while ensuring the resizer remains visible only
												// within the table area.
												height: `calc(100% + ${totalRowListHeight}px)`,
												right: "-0.3rem",
											}}
										/>
									</>
								)}
							</th>
						))}
					</tr>
				</thead>
			</table>
		</div>
	);
}

export function ColumnResizer({
	style,
	onResize,
	onResizeDone,
}: {
	readonly style?: React.CSSProperties;
	readonly onResize?: (movementX: number) => void;
	readonly onResizeDone?: () => void;
}) {
	return (
		<div
			className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
			onMouseDown={(e) => {
				const originalMouseCursor = document.body.style.cursor;

				document.body.style.cursor = "col-resize";

				// Prevent text selection
				e.preventDefault();

				function handleMouseMove(e: MouseEvent) {
					onResize?.(e.movementX);
				}

				function handleMouseUp() {
					document.body.style.cursor = originalMouseCursor;
					document.removeEventListener("mousemove", handleMouseMove);
					document.removeEventListener("mouseup", handleMouseUp);
					onResizeDone?.();
				}

				document.addEventListener("mousemove", handleMouseMove);
				document.addEventListener("mouseup", handleMouseUp);
			}}
			onClick={(e) => {
				// Prevent event bubbling
				e.stopPropagation();
				onResize?.(0);
			}}
			style={style}
		/>
	);
}

export function SortableTableRow<T, C extends string>({
	descriptor,
	columnWidths,
	row,
	rowIndex,
	style,
	rowStyle,
}: {
	readonly descriptor: SortableTableDescriptor<T, C>;
	readonly columnWidths: number[];
	readonly row: SortableTableRowDescriptor<T>;
	readonly rowIndex: number;
	readonly style?: React.CSSProperties;
	readonly rowStyle?: React.CSSProperties;
}) {
	let cells: React.ReactNode[] = [];

	for (
		let columnIndex = 0;
		columnIndex < descriptor.headerColumns.length;
		columnIndex++
	) {
		const headerColumn = descriptor.headerColumns[columnIndex];

		if (headerColumn === undefined) {
			continue;
		}

		const columnId = headerColumn.id;

		const context: SortableTableCellRendererContext<T, C> = {
			row,
			data: row.data,
			rowIndex,
			columnId,
			columnIndex,
			columnWidth: columnWidths[columnIndex] ?? 0,
		};

		cells = [
			...cells,
			<td
				key={columnId}
				className="group border-tpl relative box-border overflow-hidden border-r-2 px-2 font-normal last:border-r-0"
				style={{
					...(columnIndex !== descriptor.headerColumns.length - 1
						? {
								width: columnWidths[columnIndex],
								minWidth: columnWidths[columnIndex],
								maxWidth: columnWidths[columnIndex],
							}
						: {
								minWidth: columnWidths[columnIndex],
								width: "100%",
							}),
					height: style?.height ?? 0,
					...rowStyle,
				}}
			>
				{descriptor.cellRenderer(context)}
			</td>,
		];
	}

	return (
		<tr
			className="border-tpl odd:bg-bpl overflow-hidden border-b-2"
			style={{
				...style,
				...descriptor?.getRowStyle?.({ row, rowIndex }),
			}}
			onClick={(e) => descriptor?.onRowClick?.({ event: e, row, rowIndex })}
		>
			{cells}
		</tr>
	);
}
