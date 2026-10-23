/**
 * The compiler demo examples of the control flow pages, one list per page.
 * A page owns its programs: this file sits beside the pages, and
 * [`fjs/compiler/examples`](../../fjs/compiler/examples/module.f.js) takes its
 * area from here instead of spelling it a second time.
 *
 * @module
 *
 * @import { Examples } from '../../fjs/website/demo/examples/types.ts'
 */

/** @type {Examples} */
const guards = [
    ['Early return', 'export default (n) => {\n    if (n < 0) { return -1; }\n    if (n > 0) { return 1; }\n    return 0;\n};'],
    ['Throw', 'export default (...a) => {\n    const reason = ["not implemented", a[0]];\n    throw reason;\n};'],
]

/** @type {Examples} */
const loops = [
    ['Loop', 'export default n => {\n    let r = 1;\n    while (r < n) {\n        r = r * 2;\n    }\n    return r;\n};'],
    ['Loop over a parameter', 'export default n => {\n    while (n > 0) {\n        n = n - 7;\n    }\n    return n;\n};'],
]

/** @type {Examples} */
const switches = [
    ['Switch', 'export default node => {\n    switch (node[0]) {\n        case "array": case "object": { return "container"; }\n        case "string": { return "text"; }\n        default: { throw ["unknown", node[0]]; }\n    }\n};'],
]

export default { guards, loops, switches, all: [...guards, ...loops, ...switches] }
