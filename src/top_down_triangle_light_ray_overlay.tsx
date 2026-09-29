import { data as lightImage } from "@/images/topDownTriangleLightPngBase64";

export function TopDownTriangleLightRayOverlay() {
	return (
		<div
			className="pointer-events-none fixed left-0 top-0 h-screen w-screen bg-cover opacity-[0.4]"
			style={{
				backgroundImage: `url(${lightImage})`,
				backgroundPositionX: "center",
			}}
		/>
	);
}
