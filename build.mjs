import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";

await mkdir("dist", { recursive: true });

// Step 1: Bundle — keep @vendetta/* external, we provide them via a require shim
await build({
    entryPoints: ["src/StealSticker/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    format: "cjs",
    external: ["@vendetta", "@vendetta/*"],
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",

    // ─── Hermes compatibility ───────────────────────────────────────────────
    // Hermes syntactically accepts const/let but treats them as var,
    // which silently breaks closures (e.g. loop callbacks capture the
    // wrong binding). Force all const/let → var here so esbuild handles
    // it correctly at bundle time.
    //
    // Reference: Kettu's own build script comments and SWC config:
    //   "transform-block-scoping", "transform-async-to-generator"
    supported: {
        // Hermes treats const/let as var — broken closures in loops
        "const-and-let": false,
        // Hermes does NOT support async/await — must lower to generators
        "async-await": false,
    },
    // ────────────────────────────────────────────────────────────────────────

    logLevel: "info",
});

// Step 2: Wrap the CJS bundle in an IIFE that Kettu's eval can handle.
//
// Kettu (VdPluginManager.evalPlugin) evaluates Vendetta plugins as:
//
//   const pluginString = `vendetta=>{return ${plugin.js}}`;
//   const raw = eval(pluginString)(vendettaObject);
//
// Problem A — CJS is statements, not an expression:
//   `return var __defProp = ...` is a SyntaxError.
//   The eval throws, startPlugin's catch fires, plugin.enabled = false.
//
// Problem B — require("@vendetta/*") has no resolver at eval time:
//   Kettu exposes the whole API through the `vendetta` param, not via
//   Node/Metro module IDs. We provide a shim that maps the IDs to the
//   matching vendetta.* property.
//
// Fix: wrap the CJS bundle in an IIFE (a valid expression that returns
//   the plugin object) and inject the require shim inside it.
//   `vendetta` is a free variable — it's in scope from Kettu's wrapper.

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
            case "@vendetta/storage":
                return vendetta.storage;
            case "@vendetta/commands":
                return vendetta.commands;
            default:
                throw new Error("[StealSticker] Unknown module: " + id);
        }
    }

${cjs}

    // module.exports.default is a lazy getter set up by esbuild's __export,
    // so by the time we reach here the default export is fully assigned.
    return module.exports && module.exports.default !== undefined
        ? module.exports.default
        : module.exports;
})()`;

await writeFile("dist/index.js", wrapped);

// Step 3: Hash the final file.
// Kettu skips re-downloading JS when manifest.hash === stored hash.
// Without a hash, existingPlugin?.manifest.hash !== pluginManifest.hash
// is always undefined !== undefined → false → skips fetch → crashes.
const hash = createHash("sha256").update(wrapped).digest("hex");

const manifest = JSON.parse(
    await readFile("src/StealSticker/manifest.json", "utf8")
);
manifest.main = "index.js";
manifest.hash = hash;

await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log(`Build complete → dist/  [hash: ${hash.slice(0, 7)}]`);
