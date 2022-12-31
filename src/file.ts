import type { z } from "zod";
import type { FileSchema } from "./types";

export function File<T extends Buffer | string | object = Buffer>(
	datatype: z.ZodType<T>,
	serializer: (data: T) => Buffer = (data) => data as Buffer,
	deserializer: (data: Buffer) => T = (data) => data as T,
): FileSchema<T> {
	const schema = datatype as unknown as FileSchema<T>;
	schema.$serializer = serializer;
	schema.$deserializer = deserializer;
	return schema;
}
