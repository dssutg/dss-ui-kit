/**
 * A dotted-quad IPv4 address and nothing else: four decimal octets, each 0–255, with no leading zero
 * on a multi-digit octet and no extra text around it.
 *
 * Anchored, so it can be used to test a whole string rather than a substring — the field it validates
 * would otherwise accept `1.2.3.4 and more`.
 */
export const ipv4Regex =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;

/**
 * An IPv4 address as four octets, padded with zeroes if it is short and trimmed if it is long.
 *
 * Never throws and never validates: this is for turning an address into something indexable or
 * comparable, and a caller that needs to know the address was well formed asks
 * {@link ipv4Regex} first. A missing octet reads as zero rather than as `NaN`, which is what makes the
 * result safe to compare.
 */
export function parseIp(ip: string): number[] {
  return ip
    .trim()
    .split('.')
    .map((octet) => (parseInt(octet, 10) || 0) & 0xff)
    .concat(Array.from<number>({ length: 4 }).fill(0))
    .slice(0, 4);
}
