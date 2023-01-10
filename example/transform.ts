import { createHash } from "node:crypto";
import { mount, File, serializer } from "controlled-fs";
import { z } from "zod";

const structure = z.record(
	z
		.string()
		.describe("User ID")
		.transform((id) => createHash("md5").update(id).digest("hex")),
	File(
		z.object({
			name: z.string().describe("Name"),
			password: z
				.string()
				.describe("Password")
				.transform((id) => createHash("sha256").update(id).digest("hex")),
		}),
		...serializer.json,
	),
);

// mount to `./data`
const fs = mount("./data", structure);

const file = fs["jacoblincool"];
file.$data = { name: "Jacob Lin", password: "jacob's password" };

console.log(file.$path, file.$data);
// /workspace/data/640246d792c0bd83ac4089c2f946ebab {
//     name: 'Jacob Lin',
//     password: '94c8b775abd738f9fc928538def16264ca9ac19dad9454704f03806bdf3dc702'
// }
