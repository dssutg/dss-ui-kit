// Tell TypeScript compiler to allow to import formats below

declare module "*.png";
declare module "*.svg";
declare module "*.jpeg";
declare module "*.jpg";

declare module "*.txt?raw" {
	const content: string;
	export default content;
}

declare module "*.glsl?raw" {
	const content: string;
	export default content;
}
