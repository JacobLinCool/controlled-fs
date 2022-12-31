import type { z } from "zod";

export type FileSchema<T = any> = z.ZodType<T> & {
	$serializer: (data: T) => Buffer;
	$deserializer: (data: Buffer) => T;
};

export type DirSchema = z.ZodType<{
	[K in keyof unknown]: FileSystemSchema;
}>;

export type FileSystemSchema = DirSchema | FileSchema;

export type IsFile<T extends FileSystemSchema> = T extends FileSchema ? true : false;
export type IsDir<T extends FileSystemSchema> = IsFile<T> extends true ? false : true;
export type SubSchema<T extends DirSchema, K extends keyof z.infer<T>> = T extends z.ZodRecord
	? T["valueSchema"]
	: T extends z.ZodObject<infer S>
	? S[K]
	: never;

export type FileNode<T> = {
	get $exists(): boolean;
	get $path(): string;
	get $remove(): () => void;
	get $data(): T;
	set $data(data: T | undefined);
};

export type DirNode<T extends FileSystemSchema> = {
	get $exists(): boolean;
	get $path(): string;
	get $list(): () => string[];
	get $remove(): () => void;
} & {
	[K in keyof z.infer<T>]: IsDir<SubSchema<T, K>> extends true
		? Node<SubSchema<T, K>>
		: FileNode<z.infer<SubSchema<T, K>>>;
};

export type Node<T extends FileSystemSchema = any> = T extends FileSchema
	? FileNode<z.infer<T>>
	: DirNode<T>;

export type UntypedFileSystemSchema = z.ZodRecord<z.ZodString, FileSchema<Buffer>>;
