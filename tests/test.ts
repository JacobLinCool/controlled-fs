import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mount, File, serializer, MountOptions } from "../src";
import { z } from "zod";

const users = Array.from({ length: 10 }, (_, i) => ({
	id: randomUUID(),
	name: `User ${i}`,
	files: Array.from({ length: 3 }, (_, j) => ({
		id: randomUUID(),
		data: `This is file ${j} of user ${i}`,
	})),
}));

function reset(sub?: string) {
	const dir = path.join("testdata", sub ?? "");
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true });
	}
}

function mutate(options?: MountOptions) {
	const mutation = Object.entries(options ?? {})
		.map(([key, value]) => `${key}:${value}`)
		.join(",");
	describe(`options: ${mutation}`, () => {
		describe("single file", () => {
			reset(`single-file-${mutation}`);

			describe("txt file", () => {
				const file = mount(
					`testdata/single-file-${mutation}/file.txt`,
					File(z.string(), ...serializer.string),
					options,
				);

				test("file path is correct", () => {
					expect(file.$path).toBe(
						path.resolve(`testdata/single-file-${mutation}/file.txt`),
					);
				});

				test("not exists before assignment", () => {
					expect(file.$exists).toBe(false);
				});

				test("exists after assignment", () => {
					file.$data = "Hello World";
					expect(file.$exists).toBe(true);
				});

				test("data is correct", () => {
					expect(file.$data).toBe("Hello World");
				});

				test("data is correct after removal", () => {
					file.$data = undefined;
					expect(file.$data).toBe(undefined);
				});

				test("not exists after removal", () => {
					expect(file.$exists).toBe(false);
				});
			});

			describe("binary file", () => {
				const file = mount(
					`testdata/single-file-${mutation}/file.bin`,
					File(z.instanceof(Buffer)),
					options,
				);

				test("not exists before assignment", () => {
					expect(file.$exists).toBe(false);
				});

				test("data is correct", () => {
					file.$data = Buffer.from([0x00, 0x01, 0x02, 0x03]);
					expect(file.$data).toEqual(Buffer.from([0x00, 0x01, 0x02, 0x03]));
				});

				test("data is correct after removal", () => {
					file.$data = undefined;
					expect(file.$data).toBe(undefined);
				});
			});

			describe("json file", () => {
				const file = mount(
					`testdata/single-file-${mutation}/file.json`,
					File(
						z.object({
							string: z.string(),
							number: z.number(),
							boolean: z.boolean(),
							array: z.array(z.string()),
							object: z.object({
								key: z.string(),
							}),
						}),
						...serializer.json,
					),
					options,
				);

				test("not exists before assignment", () => {
					expect(file.$exists).toBe(false);
				});

				test("data is correct", () => {
					file.$data = {
						string: "Hello World",
						number: 123,
						boolean: true,
						array: ["Hello", "World"],
						object: {
							key: "value",
						},
					};
					expect(file.$data).toEqual({
						string: "Hello World",
						number: 123,
						boolean: true,
						array: ["Hello", "World"],
						object: {
							key: "value",
						},
					});
				});

				test("data is correct after removal", () => {
					file.$data = undefined;
					expect(file.$data).toBe(undefined);
				});
			});
		});

		describe("directory", () => {
			reset(`directory-${mutation}`);

			const dir = mount(
				`testdata/directory-${mutation}`,
				z.record(z.string().uuid(), File(z.instanceof(Buffer), ...serializer.buffer)),
				options,
			);

			const id = randomUUID();

			test("not exists before assignment", () => {
				expect(dir.$exists).toBe(false);
			});

			test("exists after assignment", () => {
				dir[id].$data = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				expect(dir[id].$exists).toBe(true);
				expect(dir.$exists).toBe(true);
			});

			test("data is correct", () => {
				expect(dir[id].$data).toEqual(Buffer.from([0x00, 0x01, 0x02, 0x03]));
			});

			test("data is correct after removal", () => {
				dir[id].$remove();
				expect(dir[id].$data).toBe(undefined);
			});

			test("not exists after removal", () => {
				dir.$remove();
				expect(dir.$exists).toBe(false);
			});
		});

		describe("has schema", () => {
			reset(`has-schema-${mutation}`);
			const data = mount(
				`testdata/has-schema-${mutation}`,
				z.object({
					users: z.record(
						z.string().uuid(),
						z.object({
							"info.json": File(z.object({ name: z.string() }), ...serializer.json),
							files: z.record(z.string(), File(z.string(), ...serializer.string)),
						}),
					),
				}),
				options,
			);

			test("valid data", () => {
				expect(data.$exists).toBe(false);
				for (const user of users) {
					expect(data.users[user.id].$exists).toBe(false);
					data.users[user.id]["info.json"].$data = { name: user.name };
					expect(data.users[user.id]["info.json"].$exists).toBe(true);
					expect(data.users[user.id]["info.json"].$data).toEqual({ name: user.name });

					for (const file of user.files) {
						expect(data.users[user.id].files[file.id].$exists).toBe(false);
						data.users[user.id].files[file.id].$data = file.data;
						expect(data.users[user.id].files[file.id].$exists).toBe(true);
						expect(data.users[user.id].files[file.id].$data).toBe(file.data);
					}
					expect(data.users[user.id].files.$list().sort()).toEqual(
						user.files.map((file) => file.id).sort(),
					);
					expect(data.users[user.id].$exists).toBe(true);
				}
				expect(data.$exists).toBe(true);
			});

			test("invalid key error", () => {
				// @ts-expect-error
				expect(() => data.abcdef).toThrow();
				expect(() => data.users.abcdef).toThrow();
				expect(() => data.users.abcdef["info.json"]).toThrow();
				expect(() => data.users[randomUUID()].files[""].$data).toThrow();
				expect(() => data.users[randomUUID()].files[".."].$data).toThrow();
				expect(() => data.users[randomUUID()].files["abc/def"].$data).toThrow();
			});
		});

		test("performance", () => {
			reset(`performance-${mutation}`);

			const fs = mount(
				`testdata/performance-${mutation}/file.json`,
				File(z.array(z.string()), ...serializer.json),
				options,
			);

			const data = Array.from({ length: 500 }, () => randomUUID());

			for (let i = 0; i < 500; i++) {
				fs.$data = [...(fs.$data || []), data[i]];
			}

			expect(fs.$data).toEqual(data);
		});
	});
}

mutate();
mutate({ cache: true });
