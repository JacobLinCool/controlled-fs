import fs from "node:fs";
import { resolve, sep } from "node:path";
import { z } from "zod";
import type {
	UntypedFileSystemSchema,
	FileSystemSchema,
	Node,
	MountOptions,
	CacheItem,
} from "./types";
import { ControlError } from "./error";
import { buffer } from "./serializer";
import { log } from "./debug";

export const fs_cache = new Map<string, Node>();

export function mount<T extends FileSystemSchema = UntypedFileSystemSchema>(
	path: string,
	schema?: T,
	options?: MountOptions,
): Node<T> {
	path = resolve(path);
	if (fs_cache.has(path)) {
		return fs_cache.get(path) as Node<T>;
	}

	options = { cache: false, ...options };
	log(`Controll: ${path} %o`, options);

	const content_cache =
		options.cache === false
			? undefined
			: options.cache === true
			? new Map<string, CacheItem>()
			: options.cache;
	const refresh_upstream = () => {
		if (!content_cache) {
			return;
		}
		const parts = path.split(sep);

		for (let i = parts.length - 1; i > 0; i--) {
			const p = parts.slice(0, i).join(sep);
			content_cache.delete(p);
		}
	};

	const serializer = schema && "$serializer" in schema ? schema.$serializer : buffer[0];
	const deserializer = schema && "$deserializer" in schema ? schema.$deserializer : buffer[1];

	const result = new Proxy({} as Node<T>, {
		get(target, key) {
			key = String(key);
			const exists = content_cache?.get(path)?.exists ?? fs.existsSync(path);
			const stat = exists ? content_cache?.get(path)?.stat ?? fs.statSync(path) : undefined;
			const is_file = exists && stat?.isFile();
			const is_dir = exists && stat?.isDirectory();
			const writeable = !exists || is_file;
			content_cache?.set(path, { exists, stat, data: content_cache?.get(path)?.data });
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
				if (!is_file) {
					return undefined;
				}

				const cached = content_cache?.get(path)?.data;
				if (cached !== undefined) {
					return deserializer(cached);
				}

				const data = fs.readFileSync(path);
				content_cache?.set(path, { exists, stat, data });
				return deserializer(data);
			}

			if (key === "$list") {
				return () => (is_dir ? fs.readdirSync(path) : []);
			}

			if (key === "$remove") {
				return () => {
					exists ? fs.rmSync(path, { recursive: true }) : undefined;
					content_cache?.set(path, { exists: false, stat: undefined, data: undefined });
					refresh_upstream();
				};
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

			return mount(resolve(path, key), subschema, {
				...options,
				cache: content_cache || false,
			});
		},
		set(target, key, value) {
			const exists = content_cache?.get(path)?.exists ?? fs.existsSync(path);
			const stat = exists ? content_cache?.get(path)?.stat ?? fs.statSync(path) : undefined;
			const is_file = exists && stat?.isFile();
			const writeable = !exists || is_file;
			content_cache?.set(path, { exists, stat, data: content_cache?.get(path)?.data });
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
					content_cache?.set(path, {
						...content_cache?.get(path),
						exists: false,
						data: undefined,
					});
				} else {
					value = schema ? schema.parse(value) : value;
					const parent = resolve(path, "..");
					if (!fs.existsSync(parent)) {
						fs.mkdirSync(parent, { recursive: true });
					}
					const serialized = serializer(value);
					fs.writeFileSync(path, serialized);
					content_cache?.set(path, {
						...content_cache?.get(path),
						exists: true,
						data: serialized,
					});
					refresh_upstream();
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
