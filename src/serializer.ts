export function json_serializer<T>(input: T): Buffer {
	return Buffer.from(JSON.stringify(input));
}

export function json_deserializer<T>(input: Buffer): T {
	return JSON.parse(input.toString());
}

export function string_serializer(input: string): Buffer {
	return Buffer.from(input);
}

export function string_deserializer(input: Buffer): string {
	return input.toString();
}

export function buffer_serializer(input: Buffer): Buffer {
	return input;
}

export function buffer_deserializer(input: Buffer): Buffer {
	return input;
}

export const json = [json_serializer, json_deserializer] as const;
export const string = [string_serializer, string_deserializer] as const;
export const buffer = [buffer_serializer, buffer_deserializer] as const;

export const serializer = { json, string, buffer };
export default serializer;
