/**
 * Which face of the cabinet a device is mounted on. A rack is described as two panels because that
 * is how the hardware is built, not because this module knows anything about it.
 */
export type RackPanelName = 'front' | 'back';

/**
 * The palette a device is drawn in. A name rather than a colour, so the eight colours that ship here
 * stay the library's own and a caller adding a ninth supplies the hex value itself.
 */
export type RackDeviceVariant =
  | 'lightSaladGreen'
  | 'lightGreen'
  | 'lightGray'
  | 'lightBlue'
  | 'darkBlue'
  | 'lightYellow'
  | 'darkMagenta'
  | 'lightRed';

/** One device mounted in the cabinet. */
export interface RackDevice {
  readonly row: number;
  readonly column: number;
  /**
   * The slot this device occupies, as the operator labels it. Drawn on the face, so it is text and
   * belongs to the caller.
   */
  readonly posLabel: string;
  /**
   * The caller's key for this kind of device. Matched against the `deviceTypes` prop of
   * `ServerRackViewProps`.
   * to decide the label and the palette; the module never interprets it.
   */
  readonly deviceType: string;
  readonly serialNumber: number;
}

/** One face of the cabinet: how many slots it has, and what is mounted in them. */
export interface RackPanel {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly devices: readonly RackDevice[];
}

/** A whole cabinet. */
export interface Rack {
  readonly id: string;
  readonly frontPanel: RackPanel;
  readonly backPanel: RackPanel;
}

/**
 * How a caller describes one of its device types to `ServerRackView`.
 *
 * `title` is the label as the caller wants it drawn, already resolved into the caller's language,
 * because the wording of a device type is the caller's vocabulary and not a key this library owns.
 * A type with no entry is not drawn, which is how a caller hides a device type without editing this
 * module.
 */
export interface RackDeviceTypeDescriptor {
  readonly title: string;
  readonly variant: RackDeviceVariant;
}

/** Device types keyed by the `deviceType` a {@link RackDevice} carries. */
export type DeviceTypeLookup = Readonly<Record<string, RackDeviceTypeDescriptor>>;

/** Identifies one device passed to the `onDeviceClick` prop of `ServerRackViewProps`. */
export interface RackDeviceRef {
  readonly deviceType: string;
  readonly serialNumber: number;
}
