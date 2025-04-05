import { defineConfig } from "orval";

module.exports = defineConfig({
	api2: {
		output: {
			// "https://api2.lifedash.link"
			// "https://api2.stag.lifedash.link"
			// "http://localhost:4002"
			baseUrl: "https://api2.lifedash.link",
			mode: "split",
			target: "gen/api.ts",
			client: "fetch",
			workspace: "src/api",
			override: {
				mutator: {
					path: "./custom-fetch.ts",
					name: "customFetch",
				},
			},
		},
		input: {
			target: "http://localhost:4002/openapi.json",
			filters: {
				mode: "include",
				tags: ["Obsidian"],
				schemas: [
					"ObsidianDocumentCreate",
					"ObsidianUpdates",
					"ObsCreate",
					/ValidationError/,
				],
			},
		},
		hooks: {
			afterAllFilesWrite: "prettier --write",
		},
	},
});
