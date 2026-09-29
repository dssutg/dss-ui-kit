import { useEffect, useRef, useState } from "react";
import type { Communicator } from "@/api";
import type { CrashReport } from "@/crash";
import type {
	AppLevelConnectionParametersUpdate,
	BCPAccessLevelListItem,
	BCPListItemOfSRV,
	BCPLogDataStruct,
	BCPMainLoopTimeDataStruct,
	BCPNetTableUpdate,
	BCPNetworkDeviceListItem,
	BCPRSProgramListItem,
	BCPServerInfo,
	BCPTCOGroupListItem,
	BCPTimezoneListItem,
	BCPType,
	BCPUserListItem,
	CfgNodeListUpdate,
	CfgNodeType,
	DebugGUIKind,
	KAUSensorCommand,
	KAUType,
	LogSnifferMessage,
	LogSnifferStats,
	MaintenanceReportListItem,
	ModbusConfiguration,
	NetworkDeviceFirmwareUploadSerialNumbersInfo,
	NetworkDeviceParameters,
	OverallBCPNetStatusList,
	RS485RingStateInfo,
	RS498RingTableStats,
	RTO,
	RTOEvent,
	SRVBriefBCPListItem,
	SRVListItem,
	SRVSubnodeType,
	ServerBCPTCO,
	ServerBCPZone,
	ServerVariant,
	SSingleSRVRTOUpdate,
	Sensor,
	ServerRack,
	ServerRackDeviceInfoByTco,
	SystemDutyMeterDataStruct,
	TCOStateUpdate,
	VLANConfig,
	ZoneFullReportDataStruct,
} from "@/def";
import type { FeatureName } from "@/feature_flag";
import type { ThemeName } from "@/theme";

export interface EventTypes {
	NEW_BCP_CPU_TEMPERATURE: number;
	NEW_BCP_LOG_DATA_STRUCT: BCPLogDataStruct;
	NEW_BCP_MAIN_LOOP_TIME_DATA_STRUCT: BCPMainLoopTimeDataStruct;
	NEW_BCP_SYSTEM_DUTY_METER_DATA_STRUCT: SystemDutyMeterDataStruct;
	NEW_BCP_ZONE_FULL_REPORT_DATA_STRUCT: ZoneFullReportDataStruct;
	NEW_LOG_RECORD: string;
	NEW_UNSTRUCTURED_KAU_LOG_RECORD: string;
	SETTINGS_UPDATE: null;
	NEW_API_RESPONSE: string;
	RS485_RING_STATE_INFO_UPDATE: RS485RingStateInfo;
	RS485_RING_STATS_TABLE_UPDATE: RS498RingTableStats;
	RESET_KAU_AL: null;
	NETWORK_DEVICE_PARAMS_UPDATE: NetworkDeviceParameters;
	UDP_CLIENT_ADDRESSES_UPDATE: string[];
	APP_LEVEL_CONNECTION_PARAMS_UPDATE: AppLevelConnectionParametersUpdate;
	NETWORK_DEVICE_FIRMWARE_UPLOAD_SERIAL_NUMBERS_INFO: NetworkDeviceFirmwareUploadSerialNumbersInfo;
	NETWORK_DEVICE_FIRMWARE_UPLOAD_PROGRESS_UPDATE: {
		percent: number;
	};
	RESET_KAU_CONFIGURATION: null;
	ID_KAU_03D_PERIOD61_INFO_UPDATE: {
		kauSerialNumber: number;
		interval: number;
	};
	NEW_KAU_LOG_RECORD: {
		kauType: KAUType;
		kauSerialNumber: number;
		message: string;
		sensorAddress: number | null;
	};
	ID_KAU_03D_TEST_MODE_STATUS_UPDATE: {
		enabled: boolean;
	};
	ID_KAU_03D_WRITE_LOG_STATUS_UPDATE: {
		enabled: boolean;
	};
	NEW_SENSOR_VARIABLE_VALUE: {
		kauSerialNumber: number;
		sensorAddress: number;
		variableAddress: number;
		error: string;
		variableValue: number;
	};
	ID_KAU_03D_SENSOR_MODE61_INFO_UPDATE: {
		kauSerialNumber: number;
		mode61Enabled: boolean;
		uminThreshold: number;
	};
	NEW_OSCILLOGRAM_DATA: {
		oscillogram1YPoints: number[];
		oscillogram2YPoints: number[];
	};
	SERVER_INFO_UPDATE: BCPServerInfo;
	NEW_SERVER_MODAL_MESSAGE: {
		type: "error" | "warning";
		content: string;
	};
	BCP_NETWORK_INFO_UPDATE: BCPNetTableUpdate;
	DELETE_CONFIGURATION_DATABASE_ADDRESS: null;
	DELETE_ALL_SYS_LOG_FILES: null;
	BCP_BACKUP_INFO_UPDATE: {
		bcpSerialNumber: number;
		bcpType: BCPType;
	};
	FULL_APP_TITLE_UPDATE: null;
	NEW_RS_VARIABLE_VALUE: {
		address: number;
		value: number;
	};
	LOG_SNIFFER_STATS_UPDATE: LogSnifferStats;
	NEW_LOG_SNIFFER_MESSAGE: LogSnifferMessage;
	NEW_BACKUP_LOG_RECORD: string;
	CPU_FREQUENCY_AND_CORE_UPDATE: {
		frequency: number;
		core1Enabled: boolean;
		core2Enabled: boolean;
		core3Enabled: boolean;
	};
	NEW_BCP_NETWORK_DEBUG_LOG_RECORD: string;
	MODBUS_CONFIGURATION_FETCH_ERROR: null;
	MODBUS_CONFIGURATION_UPDATE: ModbusConfiguration;
	MODBUS_ZONE_LIST_UPDATE: {
		id: number;
		title: string;
	}[];
	NEW_MODBUS_LOG_RECORD: string;
	SYS_LOG_INFO_UPDATE: {
		level: number;
		files: string[];
	};
	MODBUS_ENTIRE_TCO_LIST_UPDATE: {
		id: number;
		title: string;
	}[];
	OSCILLOSCOPE_IMPORT_DROPPED_FILE: File;
	OSCILLOSCOPE_OPEN_IMPORT_MANAGER: null;
	OSCILLOSCOPE_EXPORT_AS_CSV: null;
	OSCILLOSCOPE_EXPORT_AS_JSON: null;
	OSCILLOSCOPE_EXPORT_AS_PNG: null;
	OSCILLOSCOPE_OPEN_GO_TO_POINT_DIALOG: null;
	OSCILLOSCOPE_OPEN_CHART_MARKER_MANAGER: null;
	OPEN_KAU_SENSOR_EXTRA_INFO_MODAL: {
		sensor: Sensor;
	};
	OPEN_KAU_SENSOR_VARIABLE_INSPECTOR: {
		sensor: Sensor;
	};
	SEND_COMMAND_TO_KAU_SENSOR: {
		command: KAUSensorCommand;
		sensor: Sensor;
	};
	REFRESH_KAU_SENSOR: {
		sensor: Sensor;
	};
	NEW_APP_CRASH_REPORT: CrashReport;
	FEATURE_TOGGLED: {
		featureName: FeatureName;
		enabled: boolean;
	};
	ON_SWITCH_TO_ZONE_MANAGER_TAB: null;
	ON_SWITCH_TO_HOME_TAB: null;
	NEW_KAU_AL_SCAN_RESPONSE: {
		kauType: KAUType;
		kauSerialNumber: number;
		scanState: "progress" | "complete";
		foundDevices: number;
		kauDevices: Sensor[];
	};
	ON_COPY_ALL_KAU_SENSORS_FROM_AL_TO_CONFIG_RESPONSE: {
		kauType: KAUType;
		kauSerialNumber: number;
	};
	THEME_CHANGED: {
		themeName: ThemeName;
	};
	SERVER_RACK_UPDATE: ServerRack;
	NEW_SERVER_RACK_DEVICE_BY_TCO: ServerRackDeviceInfoByTco;
	TOGGLE_DEBUG_GUI: {
		guiKind: DebugGUIKind;
	};
	TCO_STATE_CHANGED: {
		tcoListUpdate: TCOStateUpdate[];
	};
	OVERALL_BCP_NETWORK_STATUS_LIST: {
		overallBcpNetworkStatusList: OverallBCPNetStatusList;
		bcpNetworkTableUpdates: BCPNetTableUpdate[];
	};
	NEW_SERVER_ADDRESS: {
		ip: string;
		port: number;
	};
	GO_TO_BCP_IN_BCP_NETWORK_AGGREGATOR_GRAPH: {
		bcpSerialNumber: number;
	};
	SERVER_NEW_SRV_RTO_LIST: {
		srvNumber: number;
		rtos: RTO[];
	};
	EVENT_LOG_SCROLL_TO_TOP: {
		instance: number;
	};
	NEW_SRV_LIST: {
		srvItems: SRVListItem[];
	};
	SERVER_NEW_BRIEF_BCP_LIST: {
		srvNumber: number;
		briefBcpList: SRVBriefBCPListItem[];
	};
	SERVER_NEW_SRV_RTO_EVENTS: {
		srvNumber: number;
		rtoEvents: RTOEvent[];
	};
	SERVER_SRV_RTO_EVENT_UPDATE: {
		srvNumber: number;
		rtoEvents: RTOEvent[];
	};
	SERVER_SINGLE_SRV_RTO_UPDATE: SSingleSRVRTOUpdate;
	API_CONNECTION_ESTABLISHED: {
		communicator: Communicator;
	};
	REFRESH_SERVER_LOG: null;
	REFRESH_SERVER_NET_DEVICES: null;
	REFRESH_BCP_STATS: null;
	NEW_BCP_LIST_OF_SRV: {
		srvNumber: number;
		bcpList: BCPListItemOfSRV[];
		success: boolean;
	};
	NEW_BCP_ZONE_LIST: {
		bcpSerialNumber: number;
		zones: ServerBCPZone[];
		success: boolean;
	};
	NEW_BCP_ZONE_TCO_LIST: {
		tcoList: ServerBCPTCO[];
		bcpSerialNumber: number;
		zoneId: number;
		success: boolean;
	};
	NEW_BCP_NETWORK_DEVICE_LIST: {
		bcpSerialNumber: number;
		networkDevices: BCPNetworkDeviceListItem[];
		success: boolean;
	};
	NEW_BCP_TCO_GROUP_LIST: {
		bcpSerialNumber: number;
		tcoGroups: BCPTCOGroupListItem[];
		success: boolean;
	};
	NEW_BCP_RS_PROGRAM_LIST: {
		bcpSerialNumber: number;
		rsPrograms: BCPRSProgramListItem[];
		success: boolean;
	};
	NEW_BCP_USER_LIST: {
		bcpSerialNumber: number;
		users: BCPUserListItem[];
		success: boolean;
	};
	NEW_BCP_TIMEZONE_LIST: {
		bcpSerialNumber: number;
		timezones: BCPTimezoneListItem[];
		success: boolean;
	};
	NEW_BCP_ACCESS_LEVEL_LIST: {
		bcpSerialNumber: number;
		accessLevels: BCPAccessLevelListItem[];
		success: boolean;
	};
	ON_TRY_QUIT_UNSAVED_FORM: null;
	ON_FORCE_QUIT_UNSAVED_FORM: null;
	ON_LOG_SAVED: null;
	ON_OPEN_CREATE_TCO_MODAL: {
		srvNumber: number;
		bcpSerialNumber: number;
		zoneId: number;
	};
	ON_OPEN_CREATE_NETWORK_DEVICE_MODAL: {
		srvNumber: number;
		bcpSerialNumber: number;
		bcpHardwareType: SRVSubnodeType;
	};
	ON_OPEN_CREATE_SERVER_MODAL: null;
	ON_OPEN_CREATE_SRV_SUBNODE_MODAL: {
		srvNumber: number;
	};
	NEW_VLAN_TAGGING_CONFIG: VLANConfig;
	NEW_CFG_NODE_LIST_UPDATE: CfgNodeListUpdate;
	DELETE_NODE_CONFIG: null;
	GET_NODE_CONFIG_FROM_BCP: null;
	SEND_NODE_CONFIG_TO_BCP: null;
	ON_LOGIN: null;
	SERVER_GET_BCP_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_GET_NDS_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_GET_ZONES_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_SEND_BCP_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_SEND_ND_CFG_RESPONSE: {
		bcpSerialNumber: number;
		ndID: number;
	};
	SERVER_SEND_NDS_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_SEND_TCO_CFG_RESPONSE: {
		bcpSerialNumber: number;
		tcoID: number;
	};
	SERVER_SEND_ZONE_CFG_RESPONSE: {
		bcpSerialNumber: number;
		zoneID: number;
	};
	SERVER_SEND_ZONES_CFG_RESPONSE: {
		bcpSerialNumber: number;
	};
	SERVER_SEND_NODES_CFG_RESPONSE: {
		bcpSN: number;
		nodeType: CfgNodeType;
		nodeID: number;
	};
	SERVER_GET_NODES_CFG_RESPONSE: {
		bcpSN: number;
		nodeType: CfgNodeType;
	};
	SERVER_EXPORT_MAINTENANCE_REPORT: {
		reportID: string | null;
	};
	SERVER_RENAME_MAINTENANCE_REPORT: MaintenanceReportListItem;
	SERVER_VARIANT_CHANGE: ServerVariant;
	DELETE_ALL_CONFIGURATOR_DB_TABLES: null;
	RESET_ALL_APP_SETTINGS: null;
	MAINTENANCE_CONFIG_TAB_SET_SEARCH_TEXT: {
		searchText: string;
	};
}

export function emitTypedEvent<T extends keyof EventTypes>(
	eventId: T,
	data: EventTypes[T],
) {
	emitEvent(eventId, data);
}

export function useTypedEvent<T extends keyof EventTypes>(
	eventId: T,
	callback: (data: EventTypes[T]) => void,
) {
	useEvent<EventTypes[T]>(eventId, (data) => {
		if (data !== undefined) {
			callback(data);
		}
	});
}

export function useTypedEventData<T extends keyof EventTypes>(eventId: T) {
	const [data, setData] = useState<EventTypes[T] | null>(null);

	useEvent<EventTypes[T]>(eventId, (data) => {
		if (data !== undefined) {
			setData(data);
		}
	});

	return data;
}

const eventCategoryName = "useEvent";

interface EventDetail<T = undefined> {
	id: string;
	data?: T;
}

// Function to emit the event
export function emitEvent<T>(eventId: string, data?: T) {
	window.dispatchEvent(
		new CustomEvent<EventDetail<T>>(eventCategoryName, {
			detail: { id: eventId, data },
		}),
	);
}

export function useEvent<T>(eventId: string, callback: (data?: T) => void) {
	const callbackRef = useRef(callback);

	// Update the ref when callback changes
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	useEffect(() => {
		function handleEvent(event: CustomEvent<EventDetail<T>>) {
			if (event.detail.id === eventId) {
				callbackRef.current(event.detail.data);
			}
		}

		window.addEventListener(eventCategoryName, handleEvent as EventListener);

		// Cleanup on unmount
		return () => {
			window.removeEventListener(
				eventCategoryName,
				handleEvent as EventListener,
			);
		};
	}, [eventId]);
}

export function onEvent<T>(eventId: string, callback: (data?: T) => void) {
	function handleEvent(event: CustomEvent<EventDetail<T>>) {
		if (event.detail.id !== eventId) {
			return;
		}
		callback(event.detail.data);
		window.removeEventListener(eventCategoryName, handleEvent as EventListener);
	}

	window.addEventListener(eventCategoryName, handleEvent as EventListener);
}
