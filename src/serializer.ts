export function serializer(input: unknown) {
	if (typeof input === "string") {
		return input;
	}

	if (input instanceof Buffer) {
		return input;
	}

	return JSON.stringify(input);
}

export function deserializer(input: Buffer) {
	return input as any;
}
