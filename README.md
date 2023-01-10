# Controlled FS

A type-safe filesystem abstraction for Node.js, with runtime validation and customizable serialization.

## Installation

```sh
pnpm i controlled-fs
```

> You can also use `npm`, `yarn` or other package managers to install `controlled-fs`, if you prefer.

## Usage

### Basics

Before using `controlled-fs`, you need to define a structure schema for your filesystem.

```ts
import { File, serializer } from "controlled-fs";
import { z } from "zod";

const structure = z.record(
	z.string(),
	File(
		z.object({
			name: z.string(),
			password: z.string(),
		}),
		...serializer.json,
	),
);
```

Then, you can mount the structure to a directory (exists or not).

> you can mount to a file if your structure is a single `File(...)`

```ts
import { mount } from "controlled-fs";

const fs = mount("./data", structure);
```

Now, you can access the type-safe filesystem using the structure schema.

```ts
// write data
fs["user1"].$data = {
    name: "User 1",
    password: "1234",
};

// read data
const user1 = fs["user1"].$data;

// remove data
fs["user1"].$data = undefined; // or fs["user1"].$remove();

// list files
const files = fs.$list();

// remove directory
fs.$remove();

// check if exists
fs["user1"].$exists(); // true or false

// get the absolute path
fs["user1"].$path; // /path/to/data/user1
```


### Transform

`controlled-fs` leverages the power of zod's `transform` method to provide a type-safe way to transform path or data before it is written to the filesystem.

[example/transform.ts](example/transform.ts)

```ts
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
```

```sh
# output
/workspace/data/640246d792c0bd83ac4089c2f946ebab {
    name: 'Jacob Lin',
    password: '94c8b775abd738f9fc928538def16264ca9ac19dad9454704f03806bdf3dc702'
}
```

## Example

This is a simple example of how to use `controlled-fs` to store JSON data and binary files in a structured filesystem.

[example.ts](example/example.ts)

```ts
import { randomUUID } from "node:crypto";
import { mount, File, serializer } from "controlled-fs";
import { z } from "zod";

// create a structure schema for
// ./users/
//         [userid]/
//                  info.json
//                  posts/
//                        [postid]
// ./images/
//          [uuid]
const structure = z.object({
    users: z.record(
        z.string().min(2).max(64),
        z.object({
            "info.json": File(z.object({ name: z.string() }), ...serializer.json),
            posts: z.record(
                z.string().uuid(),
                File(
                    z.object({
                        title: z.string(),
                        date: z.number(),
                        content: z.string(),
                        images: z.array(z.string().uuid()),
                    }),
                    ...serializer.json,
                ),
            ),
        }),
    ),
    images: z.record(z.string().uuid(), File(z.instanceof(Buffer))),
});

// mount to `./data`
const fs = mount("./data", structure);

create_user("user1", "User 1");
create_user("user2", "User 2");
create_user("user3", "User 3");

const post1 = create_post("user1", "Post 1", "This is post 1", []);
const post2 = create_post("user1", "Post 2", "This is post 2", []);

const image1 = create_image(Buffer.from("[1: should be an image buffer]"));
const image2 = create_image(Buffer.from("[2: should be an image buffer]"));
const post3 = create_post("user2", "Post 3", "This is post 3", [image1, image2]);

const users = list_users().map((user) => fs.users[user]);
for (const user of users) {
    const info = user["info.json"].$data;
    console.group(info.name);
    console.log(info);
    for (const postid of user.posts.$list()) {
        const post = user.posts[postid].$data;
        console.group(post.title);
        console.log({ ...post, images: post.images.map((image) => fs.images[image].$data) });
        console.groupEnd();
    }
    console.groupEnd();
}
fs.$remove();

function create_user(userid: string, name: string) {
    fs.users[userid]["info.json"].$data = {
        name,
    };
}

function create_post(userid: string, title: string, content: string, images: string[]) {
    const id = randomUUID();
    fs.users[userid].posts[id].$data = {
        title,
        date: Date.now(),
        content,
        images,
    };
    return id;
}

function create_image(data: Buffer) {
    const id = randomUUID();
    fs.images[id].$data = data;
    return id;
}

function get_user(userid: string) {
    return fs.users[userid]["info.json"].$data;
}

function get_post(userid: string, postid: string) {
    return fs.users[userid].posts[postid].$data;
}

function get_image(imageid: string) {
    return fs.images[imageid].$data;
}

function delete_user(userid: string) {
    fs.users[userid].$remove();
}

function delete_post(userid: string, postid: string) {
    fs.users[userid].posts[postid].$data = undefined;
}

function delete_image(imageid: string) {
    fs.images[imageid].$data = undefined;
}

function list_users() {
    return fs.users.$list();
}

function list_posts(userid: string) {
    return fs.users
        .$list()
        .map((user) => fs.users[user].posts.$list())
        .flat();
}

function list_images() {
    return fs.images.$list();
}
```
