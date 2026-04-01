import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import swc from "@swc/core";

await mkdir("dist", { recursive: true });

// Step 1: Bundle — keep @vendetta/* external, we provide them via a require shim
await build({
    entryPoints: ["src/StealSticker/index.ts"],
    bundle: true,
    outfile: "dist/index.js",
    format: "cjs",
    external: ["@vendetta", "@vendetta/*"],
    logLevel: "info",

    // ─── SWC plugin ──────────────────────────────────────────────────────────
    // esbuild 0.20.x cannot lower const/let → var via the `supported` API
    // when format is "cjs" (it only works via target:"es5" which over-transforms).
    // Instead, run SWC on every file first — exactly what Kettu does — to handle:
    //   • transform-block-scoping  (const/let → var, safe Hermes loop closures)
    //   • transform-async-to-generator  (async/await → generators for Hermes)
    // SWC also strips TypeScript types and transforms JSX with the classic pragma
    // (React.createElement / React.Fragment) so esbuild receives plain JS.
    plugins: [
        {
            name: "swc",
            setup(build) {
                build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
                    const isTsx = args.path.endsWith(".tsx");
                    const isTs  = args.path.endsWith(".ts") || isTsx;

                    const result = await swc.transformFile(args.path, {
                        jsc: {
                            parser: {
                                syntax: isTs ? "typescript" : "ecmascript",
                                tsx: isTsx,
                            },
                            transform: {
                                react: {
                                    // Classic pragma so the existing
                                    // `import { React } from "@vendetta/metro/common"`
                                    // is used — no auto-import of react/jsx-runtime.
                                    runtime: "classic",
                                    pragma: "React.createElement",
                                    pragmaFrag: "React.Fragment",
                                },
                            },
                        },
                        // https://github.com/facebook/hermes/blob/main/doc/Features.md
                        env: {
                            targets: "fully supports es6",
                            include: [
                                // Hermes treats const/let as var → broken loop closures
                                "transform-block-scoping",
                                // Hermes does NOT support async/await → lower to generators
                                "transform-async-to-generator",
                                "transform-async-generator-functions",
                            ],
                            exclude: [
                                // All of these ARE supported by Hermes — don't transform
                                "transform-parameters",
                                "transform-template-literals",
                                "transform-exponentiation-operator",
                                "transform-named-capturing-groups-regex",
                                "transform-nullish-coalescing-operator",
                                "transform-object-rest-spread",
                                "transform-optional-chaining",
                                "transform-logical-assignment-operators",
                            ],
                        },
                    });

                    // Return plain JS — types and JSX are already gone
                    return { contents: result.code, loader: "js" };
                });
            },
        },
    ],
    // ─────────────────────────────────────────────────────────────────────────
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
//
// Problem B — require("@vendetta/*") has no resolver at eval time.
//
// Fix: wrap in an IIFE with a require shim. `vendetta` is in scope
// from Kettu's wrapper.

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

    return module.exports && module.exports.default !== undefined
        ? module.exports.default
        : module.exports;
})()`;

await writeFile("dist/index.js", wrapped);

// Step 3: Hash the final file so Kettu knows when to re-fetch.
const hash = createHash("sha256").update(wrapped).digest("hex");

const manifest = JSON.parse(
    await readFile("src/StealSticker/manifest.json", "utf8")
);
manifest.main = "index.js";
manifest.hash = hash;

await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

console.log(`Build complete → dist/  [hash: ${hash.slice(0, 7)}]`);
