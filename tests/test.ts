import { control } from "../src";

const users = Array.from({ length: 10 }, (_, i) => ({
	id: `user-${i}`,
	name: `User ${i}`,
	files: Array.from({ length: 3 }, (_, j) => ({
		name: `file-${j}.txt`,
		data: `This is file ${j} of user ${i}`,
	})),
}));

const datadir = control("data");
const filedir = control<string>(
	datadir.$path + "/files",
	(data: string) => data,
	(data) => String(data),
);
const userdir = control<{ name: string; files: string[] }>(
	datadir.$path + "/users",
	JSON.stringify,
	(buffer) => JSON.parse(String(buffer)),
);

test("data/files", () => {
	for (const user of users) {
		for (const file of user.files) {
			expect(filedir[user.id][file.name].$exists).toBe(false);
			filedir[user.id][file.name].$data = file.data;
			expect(filedir[user.id][file.name].$exists).toBe(true);
		}
	}

	for (const user of users) {
		for (const file of user.files) {
			expect(filedir[user.id][file.name].$data).toEqual(file.data);
		}
	}
});

test("data/users", () => {
	for (const user of users) {
		const dir = filedir[user.id];
		if (dir.$exists && dir.$type === "dir") {
			const file = userdir[`${user.id}.json`];
			if (file.$writeable) {
				file.$data = { name: user.name, files: dir.$list() };
			}
		}
	}

	for (const user of users) {
		expect(userdir[`${user.id}.json`].$data).toEqual({
			name: user.name,
			files: user.files.map((f) => f.name),
		});
	}
});

afterAll(() => {
	if (datadir.$exists) {
		datadir.$remove();
	}
});
