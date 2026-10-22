/**
 * The compiler demo examples of the property access pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const index = [
    ['Methods and properties', 'export default ["abc".length, [1, 2, 3].at(0), (1).toString()];'],
]

/** @type {Examples} */
const optionalChaining = [
    ['Optional chaining', 'const o = { a: { b: 1 }, f: x => [x, x] };\nconst n = null;\nexport default [o?.a.b, n?.a.b, n?.[0], o.f?.(2), n?.(2), (o?.a).b];'],
    ['Optional chaining: a long chain', 'const o = { a: { f: x => [x, x] } };\nexport default i => [o?.a.f(1)[Number(i)].length, (o?.a.f)(...[i, 2])];'],
]

/** @type {Examples} */
const entries = [
    ['The entry helper', 'const entry = (a, b) => {\n    const x = Object.getOwnPropertyDescriptor(a, b);\n    return x?.enumerable ? x.value : undefined;\n};\nconst hasEntry = (a, b) => {\n    const x = Object.getOwnPropertyDescriptor(a, b);\n    return x?.enumerable === true;\n};\nconst o = { k: 1, u: undefined };\nexport default [entry(o, "k"), hasEntry(o, "u"), entry(o, "x"), entry([7, 8], 1), entry("ab", 1), hasEntry(o, "x"), typeof entry];'],
]

export default { index, optionalChaining, entries, all: [...index, ...optionalChaining, ...entries] }
