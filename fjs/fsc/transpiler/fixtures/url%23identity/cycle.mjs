// @ts-expect-error TypeScript resolves paths; this fixture tests native ESM URL escapes.
import value from "./%63ycle.mjs";
// Keep the emitted declaration independent of the URL-escaped import.
/** @type {readonly number[]} */
const result = value;
export default result;
