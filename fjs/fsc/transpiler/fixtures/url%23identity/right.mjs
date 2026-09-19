// @ts-expect-error TypeScript resolves paths; this fixture tests native ESM URL escapes.
import value from "./absent/%2e%2e/dep%20%23%25.mjs";
// Keep the emitted declaration independent of the URL-escaped import.
/** @type {readonly number[]} */
const result = value;
export default result;
