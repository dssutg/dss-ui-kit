// The entry point of this app.
import {
	Communicator,
	handleWebSocketInstantiationFailureError,
	isDummyBCPSocketServer,
	serverAPI,
	serverWSAPIEndpoint,
	useGlobalAPIReconnection,
} from "@/api";
import "@/css/index.css";
import React, {
	createPortal,
	render,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ChartTool } from "@/app_chart";
import { OverlayAppConsole } from "@/app_console";
import { getAppType } from "@/app_type";
import { BCPControlPanel } from "@/bcp_control_panel";
import { About, BCPStandbyPanel, Navbar } from "@/bcp_standby_panel";
import { loadAppConfig } from "@/config";
import {
	ErrorAndWarningMessages,
	ModalWindowManager,
} from "@/confirmation_window";
import { contacts } from "@/contact";
import { AppCrashGuard } from "@/crash";
import { DEBUG } from "@/debug_mode";
import {
	MainSectionLayoutSchema,
	ZoneStateOrderMapSchema,
	ZoneStateOrderVisibilityMapSchema,
	autoformatWSURL,
	compareVersions,
	getDefaultSettings,
	getVersionString,
	global,
	globalState,
	isServerUIInvasive,
	minServerSvnRevision,
	onGlobalStateUpdate,
	saveGlobalStateToSession,
	setTCOListState,
	switchLoginRoutingPath,
	switchLoginRoutingPathToBCPControlPanel,
	switchLoginRoutingPathToBCPStandbyPanel,
	tryRestoreGlobalStateFromSession,
	useAppState,
} from "@/def";
import { DrawTool } from "@/draw";
import { emitTypedEvent, onEvent, useTypedEvent } from "@/event";
import {
	featureNames,
	isFeatureEnabled,
	setFeatureEnabled,
} from "@/feature_flag";
import { ExhaustiveCheckDone } from "@/lib/assert";
import { minstrftime } from "@/lib/date";
import { useFetch } from "@/lib/fetch";
import { naturalCmp } from "@/lib/math";
import { useEventListener } from "@/lib/use_event_listener";
import { useGranularEffect } from "@/lib/use_granular_effect";
import { useWindowSize } from "@/lib/use_window_size";
import {
	alterLocale,
	fallBackLocale,
	isValidLocale,
	useLocale,
} from "@/locale";
import type { LocaleKeyWithoutParameters } from "@/locale_schema";
import { Logo } from "@/logo";
import { APIConnectionOverlay } from "@/overlay";
import { ResourceManager } from "@/resource";
import {
	Route,
	RouteList,
	isBCPControlPanelRoutingPath,
	routeTo,
} from "@/routing";
import { SeverRackEditor } from "@/server_rack";
import { CommonSettings } from "@/settings";
import { ServerPanel } from "@/server_panel";
import { getCurrentTheme, setTheme } from "@/theme";
import { TopDownTriangleLightRayOverlay } from "@/top_down_triangle_light_ray_overlay";
import {
	Button,
	ButtonGroup,
	CopyToClipboardButton,
	IconButton,
	ToTop,
} from "@/ui/button";
import { StaticCalendar } from "@/ui/calendar";
import { DropDownMenu } from "@/ui/dropdown";
import { Icon, IconViewer } from "@/ui/icon";
import { DecimalIntegerInput, Input, SearchInput, TextInput } from "@/ui/input";
import { Modal } from "@/ui/modal";
import { useIsMobileScreen } from "@/ui/use_is_mobile_screen";
import { UIBuilder } from "@/ui_builder";
import { WebSocketClient } from "@/ws_client";

function ErrorDialogWindow({
	message,
	visible,
	onCloseClick,
}: {
	readonly message: string;
	readonly visible: boolean;
	readonly onCloseClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
	const { t } = useLocale();
	const debugLog = useAppState((s) => s.debugLog);

	const lines = useMemo(
		() => [
			...message.split("\n"),
			"",
			"==========",
			"Debug Log:",
			"",
			...debugLog,
			"",
		],
		[message, debugLog],
	);

	// We use conditional rendering here to avoid copying debug log text
	// when we select all text (Ctrl + A) on the app page. We want the
	// text to appear and be available for copying only when this error
	// window is visible.
	if (!visible) {
		return null;
	}

	return (
		<div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center bg-black bg-opacity-25">
			<div className="box-border flex w-screen max-w-[100vw] animate-popup flex-col items-center justify-center gap-8 rounded-none bg-bda p-4 text-bdat shadow-lg shadow-black sm:w-[80vw] sm:max-w-none sm:rounded-lg">
				<div className="box-border flex max-h-[50vh] w-full flex-col gap-2 overflow-auto pb-1 pl-0 pr-1 pt-0 text-bdat">
					{lines.map((line, lineno) => (
						<p className="m-0" key={lineno}>
							{line}
						</p>
					))}
				</div>
				<div className="box-border flex w-full gap-4">
					<div className="ml-auto">
						<Button
							type="dangerous"
							icon="times"
							title={t("ErrorDialogWindow.close")}
							onClick={onCloseClick}
						/>
					</div>
					<div className="ml-auto">
						<CopyToClipboardButton contentToCopy={() => lines.join("\n")} />
					</div>
				</div>
			</div>
		</div>
	);
}


// Updates scrollbar width for the CSS rules that need it. There is
// no direct way to get the scroll bar width in CSS so there's a
// workaround used.
function updateScrollbarWidth() {
	const [html] = document.querySelectorAll("html");
	const [firstStyleSheet] = document.styleSheets;

	if (!html || !firstStyleSheet) {
		return;
	}

	const hiddenDiv = document.createElement("div");

	hiddenDiv.style.visibility = "hidden";
	hiddenDiv.style.overflow = "scroll";
	hiddenDiv.style.width = "100px";
	hiddenDiv.style.height = "100px";

	document.body.appendChild(hiddenDiv);

	const scrollbarPixelWidth = hiddenDiv.offsetWidth - hiddenDiv.clientWidth;

	hiddenDiv.remove();

	html.classList.add("no-scrollbar");
	document.body.classList.add("no-scrollbar");

	firstStyleSheet.insertRule(
		`:root { --scrollbar-pixel-width: ${scrollbarPixelWidth}px }`,
	);

	globalState.scrollBarPixelSize = scrollbarPixelWidth;
	onGlobalStateUpdate();
}
