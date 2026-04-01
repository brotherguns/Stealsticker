import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "fs/promises";

await mkdir("dist", { recursive: true });

await build({
    entryPoints: ["src/StealSticker/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    format: "cjs",
    // @vendetta/* are provided by the Discord mod runtime at load time
    external: ["@vendetta", "@vendetta/*"],
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    logLevel: "info",
});

// Copy manifest and make sure main points to the built JS
const manifest = JSON.parse(
    await readFile("src/StealSticker/manifest.json", "utf8")
);
manifest.main = "index.js";
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log("Build complete → dist/");
