import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";

await mkdir("dist", { recursive: true });

// Step 1: bundle all internal modules, leaving @vendetta/* as external require() calls
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

// Step 2: wrap the CJS bundle so it works inside Kettu's eval.
//
// Kettu evaluates Vendetta plugins as:
//
//   const pluginString = `vendetta=>{return ${plugin.js}}`;
//   const raw = eval(pluginString)(vendettaObject);
//
// Problem A — syntax:
//   CJS output is a sequence of statements (var decls, assignments).
//   You can't `return` a statement — it causes a SyntaxError, the plugin
//   silently fails to enable, and gets disabled immediately.
//
// Problem B — require():
//   The CJS bundle has bare require("@vendetta/metro") etc. calls.
//   Kettu doesn't register those paths as Metro modules; it exposes
//   everything through the `vendetta` object it passes in.
//
// Fix: wrap the whole bundle in an IIFE (a valid expression) that
//   - sets up `module` / `exports` for the CJS runtime
//   - provides a require() shim that maps @vendetta/* → vendetta.*
//   - returns the plugin's default export at the end
//
// `vendetta` is a free variable inside the IIFE — it's resolved from
// the outer closure that Kettu's arrow function creates.

const cjs = await readFile("dist/index.js", "utf8");

const wrapped = `(function () {
    var module = { exports: {} };
    var exports = module.exports;

    function require(id) {
        switch (id) {
            case "@vendetta":
                return vendetta;
            case "@vendetta/patcher":
                return vendetta.patcher;
            case "@vendetta/metro":
                return vendetta.metro;
            case "@vendetta/metro/common":
                return vendetta.metro.common;
            case "@vendetta/utils":
                return vendetta.utils;
            case "@vendetta/ui":
                return vendetta.ui;
            case "@vendetta/ui/assets":
                return vendetta.ui.assets;
            case "@vendetta/ui/toasts":
                return vendetta.ui.toasts;
            case "@vendetta/ui/components":
                return vendetta.ui.components;
            default:
                throw new Error("[StealSticker] Unknown module: " + id);
        }
    }

${cjs}

    // module.exports.default is a lazy getter esbuild sets up via __export,
    // so by the time we reach here index_default is fully assigned.
    return module.exports && module.exports.default !== undefined
        ? module.exports.default
        : module.exports;
})()`;

await writeFile("dist/index.js", wrapped);

// Step 3: hash the final file.
// Kettu skips downloading JS when hash matches the stored one.
// Without this, it would never fetch — see VdPluginManager.fetchPlugin:
//   if (existingPlugin?.manifest.hash !== pluginManifest.hash) { fetch... }
const hash = createHash("sha256").update(wrapped).digest("hex");

const manifest = JSON.parse(
    await readFile("src/StealSticker/manifest.json", "utf8")
);
manifest.main = "index.js";
manifest.hash = hash;

await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log(`Build complete → dist/  [hash: ${hash.slice(0, 7)}]`);
