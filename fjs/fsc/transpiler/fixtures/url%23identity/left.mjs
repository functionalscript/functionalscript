// @ts-expect-error TypeScript resolves paths; this fixture tests native ESM URL escapes.
import value from "./dep%20%23%25.mjs";
export default value;
