/**
 * Compiled by `fjs compile` into `../gen.fixtures/string-methods.rs`, committed and
 * drift-checked by `npm run gen` (see `../../../fjs/ci/README.md`). Consumed by
 * `../src/lib.rs`. Pins one family's members that take arguments: a string's slicing, padding, searching, splitting and replacing, and its code units and points.
 */
const s = "hello, wörld";
export default [
    s.slice(1, 4),
    s.slice(-3),
    s.substring(4, 1),
    s.padStart(14, "*"),
    s.padEnd(14, "ab"),
    s.repeat(2),
    s.split(", "),
    s.replace("l", "L"),
    s.replaceAll("l", "L"),
    s.indexOf("o"),
    s.lastIndexOf("o"),
    s.includes("wör"),
    s.startsWith("hello"),
    s.endsWith("wörld"),
    s.at(1),
    s.at(-1),
    s.charAt(1),
    s.charCodeAt(1),
    s.codePointAt(8),
    "  x ".trim(),
    "  x ".trimStart(),
    "  x ".trimEnd(),
    // @ts-expect-error — the point is the conversion TypeScript refuses.
    s.concat("!", 1),
    // @ts-expect-error — ES2024, past the library the project type-checks against.
    "a\ud800".isWellFormed(),
    // @ts-expect-error — ditto.
    "a\ud800".toWellFormed(),
];
