import { global } from "@/def";
import { emitTypedEvent, useTypedEvent } from "@/event";
import { useForceUpdate } from "@/lib/use_force_update";

export function useFeatureFlag(featureName: FeatureName) {
	const forceUpdate = useForceUpdate();

	useTypedEvent("FEATURE_TOGGLED", ({ featureName: toggledFeatureName }) => {
		if (featureName === toggledFeatureName) {
			forceUpdate();
		}
	});

	return isFeatureEnabled(featureName);
}

export function isFeatureEnabled(featureName: FeatureName) {
	return global.FEATURE_MAP[featureName];
}

export function setFeatureEnabled(featureName: FeatureName, enabled: boolean) {
	global.FEATURE_MAP[featureName] = enabled;
	emitTypedEvent("FEATURE_TOGGLED", { featureName, enabled });
	return enabled;
}

export function toggleFeature(featureName: FeatureName) {
	return setFeatureEnabled(featureName, !isFeatureEnabled(featureName));
}

export const featureNames = ["kauConfigTab"] as const;

export type FeatureName = (typeof featureNames)[number];

export function isValidFeatureName(
	featureName: string,
): featureName is FeatureName {
	return new Set<string>(featureNames).has(featureName);
}

export type FeatureMap = Record<FeatureName, boolean>;
