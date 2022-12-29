export type ShadowControlledDirectory<T = unknown> = {
	// @ts-expect-error
	get $type(): "dir";
	// @ts-expect-error
	get $exists(): false;
	// @ts-expect-error
	get $writeable(): false;
	// @ts-expect-error
	get $path(): string;
	// @ts-expect-error
	get $remove(): undefined;
	// @ts-expect-error
	get $list(): undefined;
	[key: string]: ControlledNode<T>;
};

export type ControlledDirectory<T = unknown> = {
	// @ts-expect-error
	get $type(): "dir";
	// @ts-expect-error
	get $exists(): true;
	// @ts-expect-error
	get $writeable(): false;
	// @ts-expect-error
	get $path(): string;
	/**
	 * Remove the directory if it exists
	 */
	// @ts-expect-error
	get $remove(): () => void;
	// @ts-expect-error
	get $list(): () => string[];
	[key: string]: ControlledNode<T>;
};

export type ShadowControlledFile<T = unknown> = {
	// @ts-expect-error
	get $type(): "file";
	// @ts-expect-error
	get $exists(): false;
	// @ts-expect-error
	get $writeable(): true;
	// @ts-expect-error
	get $path(): string;
	// @ts-expect-error
	get $remove(): undefined;
	// @ts-expect-error
	get $data(): T;
	set $data(value: T);
	[key: string]: ControlledNode<T>;
};

export type ControlledFile<T = unknown> = {
	// @ts-expect-error
	get $type(): "file";
	// @ts-expect-error
	get $exists(): true;
	// @ts-expect-error
	get $writeable(): true;
	// @ts-expect-error
	get $path(): string;
	/**
	 * Remove the file if it exists
	 */
	// @ts-expect-error
	get $remove(): () => void;
	// @ts-expect-error
	get $data(): T;
	set $data(value: T);
	[key: string]: ControlledNode<T>;
};

export type ControlledNode<T = unknown> =
	| ShadowControlledFile<T>
	| ControlledFile<T>
	| ShadowControlledDirectory<T>
	| ControlledDirectory<T>;

export type Serializer<T = unknown> = (input: T) => Buffer | string;
export type Deserializer<T = unknown> = (input: Buffer) => T;
