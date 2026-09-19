import v0 from "./suffix-dep.mjs";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v1 from "./suffix-dep.mjs?v=1";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v2 from "./%73uffix-dep.mjs?v=1";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v3 from "./suffix-dep.mjs?v=2";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v4 from "./suffix-dep.mjs#a";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v5 from "./suffix-dep.mjs#b";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v6 from "./suffix-dep.mjs?";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v7 from "./suffix-dep.mjs#";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v8 from "./suffix-dep.mjs?#";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v9 from "./suffix-dep.mjs?v=1#";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v10 from "./suffix-dep.mjs?v=1#a";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v11 from "./suffix-dep.mjs?v=1#a";
// @ts-expect-error TypeScript does not resolve ESM URL components.
import v12 from "./suffix-dep.mjs?bad%/a:b#%2F";
export default [v0, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12];
