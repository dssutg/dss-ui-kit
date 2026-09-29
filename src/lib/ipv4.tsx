// Exact match only IPv4 address like xxx.xxx.xxx.xxx
export const ipv4Regex =
	/^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/;

export function parseIp(ip: string): number[] {
	return ip
		.trim()
		.split(".")
		.map((octet) => (parseInt(octet, 10) || 0) & 0xff)
		.concat(Array.from<number>({ length: 4 }).fill(0))
		.slice(0, 4);
}
