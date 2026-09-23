import { resolve } from "node:path"
import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
	main: {
		plugins: [externalizeDepsPlugin()],
		resolve: { alias: { "@shared": resolve("src/shared") } },
		build: {
			rollupOptions: {
				input: { main: resolve("src/main/main.ts") },
				output: { entryFileNames: "[name].js" },
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		resolve: { alias: { "@shared": resolve("src/shared") } },
		build: {
			rollupOptions: {
				input: { preload: resolve("src/preload/preload.ts") },
				output: { entryFileNames: "[name].js", format: "cjs" },
			},
		},
	},
	renderer: {
		root: "src/renderer",
		plugins: [react()],
		resolve: { alias: { "@shared": resolve("src/shared") } },
		build: {
			rollupOptions: {
				input: {
					index: resolve("src/renderer/index.html"),
					popup: resolve("src/renderer/popup.html"),
					quickadd: resolve("src/renderer/quickadd.html"),
				},
			},
		},
	},
})
