import fs from "node:fs";
import { join, resolve } from "node:path";
import debug from "debug";
import { ControlError } from "./error";
import { ControlledNode, Serializer, Deserializer } from "./types";
import {
	serializer as default_serializer,
	deserializer as default_deserializer,
} from "./serializer";

const log = debug("controlled-fs");

export const controlled_cache = new Map<string, ControlledNode>();

export function control<T = Buffer>(
	path: string,
	serializer: Serializer<T> = default_serializer,
	deserializer: Deserializer<T> = default_deserializer,
): ControlledNode<T> {
	path = resolve(path);
	if (controlled_cache.has(path)) {
		return controlled_cache.get(path) as ControlledNode<T>;
	}
	log(`Controll: ${path}`);

	const result = new Proxy({} as ControlledNode<T>, {
		get(target, key) {
			const exists = fs.existsSync(path);
			const is_file = exists && fs.statSync(path).isFile();
			const is_dir = exists && fs.statSync(path).isDirectory();
			const writeable = !exists || is_file;
			log(`Get: ${path} ${String(key)} %o`, {
				state: exists ? (is_dir ? "dir" : "file") : "virtual",
				writeable,
			});

			if (key === "$type") {
				return is_dir ? "dir" : "file";
			}

			if (key === "$exists") {
				return exists;
			}

			if (key === "$writeable") {
				return writeable;
			}

			if (key === "$path") {
				return path;
			}

			if (key === "$data" && is_file) {
				return deserializer(fs.readFileSync(path));
			}

			if (key === "$list" && is_dir) {
				return () => fs.readdirSync(path);
			}

			if (key === "$remove" && exists) {
				return () => fs.rmSync(path, { recursive: true });
			}

			return control<T>(join(path, key.toString()), serializer, deserializer);
		},
		set(target, key, value) {
			const exists = fs.existsSync(path);
			const is_file = exists && fs.statSync(path).isFile();
			const is_dir = exists && fs.statSync(path).isDirectory();
			const writeable = !exists || is_file;
			log(`Set: ${path} ${String(key)} %o`, {
				state: exists ? (is_dir ? "dir" : "file") : "virtual",
				writeable,
			});

			if (!writeable) {
				throw new ControlError(`Cannot write to ${path}`);
			}

			if (key === "$data") {
				const parent = join(path, "..");
				if (!fs.existsSync(parent)) {
					fs.mkdirSync(parent, { recursive: true });
				}
				const serialized = serializer(value);
				fs.writeFileSync(path, serialized);
				log(
					`Write: ${path} (type: ${
						typeof serialized === "string" ? "string" : "buffer"
					}, length: ${serialized.length})`,
				);
			}

			return true;
		},
	});

	controlled_cache.set(path, result);
	return result;
}
