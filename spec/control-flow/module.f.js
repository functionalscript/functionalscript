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
    ['Early return', 'export default (n) => {\n    if (n < 0) { return -1; }\n    if (n > 0) { return 1; }\n    return 0;\n};', 'early-return'],
    ['Throw', 'export default (...a) => {\n    const reason = ["not implemented", a[0]];\n    throw reason;\n};', 'throw'],
]

/** @type {Examples} */
const loops = [
    ['Loop', 'export default n => {\n    let r = 1;\n    while (r < n) {\n        r = r * 2;\n    }\n    return r;\n};', 'loop'],
    ['Loop over a parameter', 'export default n => {\n    while (n > 0) {\n        n = n - 7;\n    }\n    return n;\n};', 'loop-over-a-parameter'],
    ['Loop with two variables', 'export default n => {\n    let value = 1;\n    let steps = 0;\n    while (value < n) {\n        value = value * 2;\n        steps = steps + 1;\n    }\n    return [value, steps];\n};', 'loop-with-two-variables'],
    ['Loop with a conditional', 'export default n => {\n    let i = 0;\n    let sum = 0;\n    while (i < n) {\n        if (i > 3) {\n            sum = sum + i;\n        }\n        i = i + 1;\n    }\n    return [i, sum];\n};', 'loop-with-a-conditional'],
    ['Loop with alternative branches', 'export default n => {\n    let i = 0;\n    let sum = 0;\n    while (i < n) {\n        if (i < 2) {\n            sum = sum + i;\n        } else if (i < 4) {\n            sum = sum + 2 * i;\n        } else {\n            sum = sum + 3 * i;\n        }\n        i = i + 1;\n    }\n    return [i, sum];\n};', 'loop-with-alternative-branches'],
    ['Nested loops', 'export default n => {\n    let i = 0;\n    let sum = 0;\n    while (i < n) {\n        let j = 0;\n        while (j < 2) {\n            sum = sum + i + j;\n            j = j + 1;\n        }\n        i = i + 1;\n    }\n    return [i, sum];\n};', 'nested-loops'],
    ['Loop with break and continue', 'export default n => {\n    let i = 0;\n    let sum = 0;\n    while (i < n) {\n        i = i + 1;\n        if (i === 3) { continue; }\n        if (i > 5) { break; }\n        sum = sum + i;\n    }\n    return [i, sum];\n};', 'loop-with-break-and-continue'],
    ['Loop with no state', 'export default n => {\n    while (false) {\n        const unreached = null.x;\n    }\n    return n;\n};', 'loop-with-no-state'],
    ['Sequential loops', 'export default n => {\n    let value = 1;\n    let steps = 0;\n    while (value < n) {\n        value = value * 2;\n        steps = steps + 1;\n    }\n    while (steps > 0) {\n        steps = steps - 1;\n    }\n    return [value, steps];\n};', 'sequential-loops'],
    ['Loop in a guard', 'export default n => {\n    if (n < 0) {\n        let total = 0;\n        while (n < 0) {\n            total = total + n;\n            n = n + 1;\n        }\n        return total;\n    }\n    return n;\n};', 'loop-in-a-guard'],
    ['Module loop', 'let i = 0;\nlet sum = 0;\nwhile (i < 5) {\n    sum = sum + i;\n    i = i + 1;\n}\nexport default [i, sum];', 'module-loop'],
    ['Loop between exports', 'let value = 0;\nexport const before = value;\nwhile (value < 3) {\n    value = value + 1;\n}\nexport const after = value;\nexport default [before, after];', 'loop-between-exports'],
]

/** @type {Examples} */
const switches = [
    ['Switch', 'export default node => {\n    switch (node[0]) {\n        case "array": case "object": { return "container"; }\n        case "string": { return "text"; }\n        default: { throw ["unknown", node[0]]; }\n    }\n};', 'switch'],
]

export default { guards, loops, switches, all: [...guards, ...loops, ...switches] }
