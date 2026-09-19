// @ts-expect-error TypeScript resolves paths; this fixture tests native ESM URL escapes.
import value from "./%63ycle.mjs";
export default value;
