import fs from "node:fs";
import { resolve, sep } from "node:path";
import { z } from "zod";
import type { UntypedFileSystemSchema, FileSystemSchema, Node } from "./types";
import { ControlError } from "./error";
import { buffer } from "./serializer";
import { log } from "./debug";

export const fs_cache = new Map<string, Node>();

export function mount<T extends FileSystemSchema = UntypedFileSystemSchema>(
	path: string,
	schema?: T,
): Node<T> {
	path = resolve(path);
	if (fs_cache.has(path)) {
		return fs_cache.get(path) as Node<T>;
	}
	log(`Controll: ${path}`);

	const serializer = schema && "$serializer" in schema ? schema.$serializer : buffer[0];
	const deserializer = schema && "$deserializer" in schema ? schema.$deserializer : buffer[1];

	const result = new Proxy({} as Node<T>, {
		get(target, key) {
			key = String(key);
			const exists = fs.existsSync(path);
			const stat = exists ? fs.statSync(path) : undefined;
			const is_file = exists && stat?.isFile();
			const is_dir = exists && stat?.isDirectory();
			const writeable = !exists || is_file;
			log(`Get: ${path} ${key} %o`, {
				exists,
				writeable,
			});

			if (key === "$exists") {
				return exists;
			}

			if (key === "$path") {
				return path;
			}

			if (key === "$data") {
				return is_file ? deserializer(fs.readFileSync(path)) : undefined;
			}

			if (key === "$list") {
				return () => (is_dir ? fs.readdirSync(path) : []);
			}

			if (key === "$remove") {
				return () => (exists ? fs.rmSync(path, { recursive: true }) : undefined);
			}

			if (schema instanceof z.ZodObject) {
				if (!(key in schema.shape)) {
					throw new ControlError(`No such key: ${key}`);
				}
			} else if (schema instanceof z.ZodRecord) {
				schema.keySchema.parse(key);
			}

			if (key.length === 0 || key.includes(sep) || !resolve(path, key).startsWith(path)) {
				throw new ControlError(`Invalid path: ${key}`);
			}

			const subschema =
				schema instanceof z.ZodObject
					? schema.shape[key]
					: schema instanceof z.ZodRecord
					? schema.valueSchema
					: undefined;

			if (subschema === undefined) {
				throw new ControlError(`No such key: ${key}`);
			}

			return mount(resolve(path, key), subschema);
		},
		set(target, key, value) {
			const exists = fs.existsSync(path);
			const stat = exists ? fs.statSync(path) : undefined;
			const is_file = exists && stat?.isFile();
			const writeable = !exists || is_file;
			log(`Set: ${path} ${String(key)} %o`, {
				exists,
				writeable,
			});

			if (!writeable) {
				throw new ControlError(`Cannot write to ${path}`);
			}

			if (key === "$data") {
				if (value === undefined) {
					fs.rmSync(path, { recursive: true });
				} else {
					value = schema ? schema.parse(value) : value;
					const parent = resolve(path, "..");
					if (!fs.existsSync(parent)) {
						fs.mkdirSync(parent, { recursive: true });
					}
					const serialized = serializer(value);
					fs.writeFileSync(path, serialized);
					log(`Write: ${path} (length: ${serialized.length})`);
				}
			}

			return true;
		},
	});

	// @ts-expect-error
	fs_cache.set(path, result);
	return result;
}
