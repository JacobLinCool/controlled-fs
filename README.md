# Controlled FS

Make the filesystem under your control!

```ts
import { control } from "controlled-fs";

// prepare some data
const users = Array.from({ length: 10 }, (_, i) => ({
	id: `user-${i}`,
	name: `User ${i}`,
	files: Array.from({ length: 3 }, (_, j) => ({
		name: `file-${j}.txt`,
		data: `This is file ${j} of user ${i}`,
	})),
}));

// take control of some directories
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

// write some data
for (const user of users) {
	for (const file of user.files) {
		filedir[user.id][file.name].$data = file.data;
	}

	const dir = filedir[user.id];

	if (dir.$exists && dir.$type === "dir") {
		userdir[`${user.id}.json`].$data = {
			name: user.name,
			files: dir.$list(),
		};
	}
}

// remove all data
if (datadir.$exists) {
	datadir.$remove();
}
```
