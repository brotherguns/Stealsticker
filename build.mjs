import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";

await mkdir("dist", { recursive: true });

await build({
    entryPoints: ["src/StealSticker/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    format: "cjs",
    external: ["@vendetta", "@vendetta/*"],
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    logLevel: "info",
});

// Hash the built JS — Kettu compares this to decide whether to re-fetch
const js = await readFile("dist/index.js", "utf8");
const hash = createHash("sha256").update(js).digest("hex");

const manifest = JSON.parse(
    await readFile("src/StealSticker/manifest.json", "utf8")
);
manifest.main = "index.js";
manifest.hash = hash;

await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log(`Build complete → dist/  [hash: ${hash.slice(0, 7)}]`);
