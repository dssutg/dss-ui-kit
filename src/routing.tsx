import React from "react";
import {
	type ServerRackDeviceInfoByTco,
	global,
	globalState,
	setOverlayRoutingPath,
	setRoutingPath,
	useAppState,
} from "@/def";
import { parseDSV, serializeDSV } from "@/lib/dsv";

export function Route(_: {
	readonly path: string;
	readonly component: React.ReactNode;
}) {
	return null;
}

export function RouteList({
	children,
}: {
	readonly children: React.ReactNode;
}) {
	const routingPath = useAppState((s) => s.routingPath);

	let renderedComponent: React.ReactNode = null;
	let foundPath = false;

	React.Children.forEach(children, (child) => {
		// biome-ignore lint: lint/suspicious/noExplicitAny
		const kid = child as any;

		if (foundPath || !React.isValidElement(child) || kid?.type !== Route) {
			return;
		}

		const { path, component } = kid.props as {
			path: string;
			component: React.ReactNode;
		};

		if (
			path !== "*" &&
			!isChildRoutingPath(path, routingPath) &&
			matchRoutingPath(path, routingPath) === null
		) {
			return;
		}

		renderedComponent = component;
		foundPath = true;
	});

	return renderedComponent;
}

export function parseRoutingPath(routingPath: string) {
	return parseDSV(routingPath.replace(/^\/+/, "").replace(/\/+$/, ""), "/")
		.columns;
}

export interface RoutingPathMatch {
	params: Record<string, string>;
}

export function matchRoutingPath(
	routingPathPattern: string | string[],
	routingPath: string,
): RoutingPathMatch | null {
	function match(
		routingPathPattern: string,
		routingPath: string,
	): RoutingPathMatch | null {
		const params: Record<string, string> = {};

		const routingPathComponents = parseRoutingPath(routingPath);
		const routingPathPatternComponents = parseRoutingPath(routingPathPattern);

		if (routingPathComponents.length !== routingPathPatternComponents.length) {
			return null;
		}

		for (const [
			partIndex,
			routingPathPatternComponent,
		] of routingPathPatternComponents.entries()) {
			const patternPart = routingPathPatternComponent!;
			const pathPart = routingPathComponents[partIndex]!;

			if (pathPart === undefined) {
				return null;
			}

			if (patternPart === "*") {
				break; // consume the rest of the string
			}

			if (patternPart.startsWith(":")) {
				const partName = patternPart.slice(1);
				params[partName] = pathPart;
				continue;
			}

			if (patternPart !== pathPart) {
				return null;
			}
		}

		return { params };
	}

	if (typeof routingPathPattern === "string") {
		return match(routingPathPattern, routingPath);
	}

	for (const pattern of routingPathPattern) {
		const matchResult = match(pattern, routingPath);

		if (matchResult !== null) {
			return matchResult;
		}
	}

	return null;
}

export interface RoutingPathDispatchTableEntry<T> {
	path: string[];
	handler: (match: RoutingPathMatch) => T;
}

export type RoutingPathDispatchTable<T> = RoutingPathDispatchTableEntry<T>[];

export function dispatchRoutingPath<T>(
	dispatchTable: RoutingPathDispatchTable<T>,
	routingPath: string,
) {
	for (const { path, handler } of dispatchTable) {
		const match = matchRoutingPath(path, routingPath);

		if (match) {
			return { result: handler(match), matched: true };
		}
	}

	return { result: null, matched: false };
}

export type RoutingPathDispatchMap<T> = Readonly<
	Record<string, (match: RoutingPathMatch) => T>
>;

export function dispatchRoutingPathMap<T>(
	dispatchMap: RoutingPathDispatchMap<T>,
	routingPath: string,
) {
	for (const path in dispatchMap) {
		const match = matchRoutingPath(path, routingPath);

		const handler = dispatchMap[path]!;

		if (match) {
			return { result: handler(match), matched: true };
		}
	}

	return { result: null, matched: false };
}

export function buildRoutingPath(pathComponents: string[]) {
	return `/${serializeDSV(pathComponents, "/")}`;
}

export function escapeRoutingPathPart(part: string | number) {
	// Fast path for number
	if (typeof part === "number") {
		return part.toString();
	}

	return part.replace(/\\/g, "\\\\").replace(/\//g, "\\/");
}

export function isChildRoutingPath(parentPath: string, childPath: string) {
	return (
		childPath.startsWith(parentPath) && childPath[parentPath.length] === "/"
	);
}

export function getRoutingPathDepth(routingPath: string) {
	let count = 0;
	let backslashRun = 0;

	for (let i = 0, len = routingPath.length; i < len; i++) {
		const ch = routingPath[i];

		if (ch === "\\") {
			// Accumulate consecutive backslashes
			backslashRun++;
		} else if (ch === "/") {
			// If we have an even number of "\" before this "/", it's unescaped
			if ((backslashRun & 1) === 0) {
				count++;
			}

			// Reset run
			backslashRun = 0;
		} else {
			// Any other character resets the backslash run
			backslashRun = 0;
		}
	}

	return count;
}

export function isBCPControlPanelRoutingPath(routingPath: string) {
	return routingPath.startsWith("/BcpControlPanel");
}

export function routeTo(to: string) {
	setRoutingPath(to);
	window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export function routeToServerRackDevice(deviceInfo: ServerRackDeviceInfoByTco) {
	global.bcpComm.fetchServerRackIdList();
	global.bcpComm.fetchServerRackById(deviceInfo.serverRackId);

	const isBCPControlPanel = isBCPControlPanelRoutingPath(
		globalState.routingPath,
	);

	const rackIdPart = escapeRoutingPathPart(deviceInfo.serverRackId);
	const devicePart = escapeRoutingPathPart(JSON.stringify(deviceInfo));

	if (isBCPControlPanel) {
		routeTo(`/BcpControlPanel/ServerRack/${rackIdPart}/devices/${devicePart}`);
	} else {
		routeTo(`/serverRack/${rackIdPart}/devices/${devicePart}`);
	}
}

export function routeToOverlay(to: string) {
	setOverlayRoutingPath(to);
	window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

export function resetOverlayRoutingPath() {
	routeToOverlay("/");
}
