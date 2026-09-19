import a from "./left.mjs";
import b from "./right.mjs";
// @ts-expect-error TypeScript resolves paths; this fixture tests native ESM URL escapes.
import c from "./%64ep%20%23%25.mjs";
import d from "./other.mjs";
export default [a, b, c, d];
