// @ts-nocheck
// The normalized FAST of a FunctionalScript module, as the compiler makes
// it today: what the lowering of doc/sasha-gil/ir/definition.md reads. The
// note quotes this output, and definition.samples.mjs is lowered from it by
// hand.
//
//     node definition.fast.mjs                      the L1 module: its top-level statements, one per line
//     node definition.fast.mjs stringEquals         one function of it, by the name it is exported under
//     node definition.fast.mjs 145                  one function, by the index of its target
//     node definition.fast.mjs path/module.f.js 9   the same for another module
//
// It is a prototype, not part of the build, and it is plain JavaScript
// without types, so it opts out of the tsconfig's check above.

import { readFileSync } from 'node:fs'
import { parse } from '../../../fjs/compiler/transpiler/module.f.mjs'
import { tryUnresolved } from '../../../fjs/compiler/edag/module.f.mjs'
import { checked, identityAnalysis } from '../../../fjs/edag/analysis/module.f.mjs'
import { fromAnalysis } from '../../../fjs/edag/to_fast/module.f.mjs'

const isFile = arg => arg.endsWith('.js') || arg.endsWith('.mjs')
const args = process.argv.slice(2)
const file = args.find(isFile) ?? new URL('../../../fjs/wasm/runtime/l1/module.f.js', import.meta.url)
const which = args.find(arg => !isFile(arg))

/** A step of the compiler's pipeline answers `['ok', value]` or `['error', reason]`. */
const ok = (step, result) => {
    if (result[0] === 'error') { console.error(`${step}: ${JSON.stringify(result[1])}`); process.exit(1) }
    return result[1]
}
const ast = ok('parse', parse('')(readFileSync(file, 'utf8')))
const edag = ok('lower', tryUnresolved(ast)).edag
const fast = fromAnalysis(ok('check', checked(ok('analysis', identityAnalysis(edag)))))

const text = x => JSON.stringify(x, (_, y) => typeof y === 'bigint' ? `${y}n` : y === undefined ? null : y)
/** JSON that breaks a line only where it is longer than `width`. */
const compact = (x, pad = '', width = 120) => {
    const flat = text(x)
    if (flat.length + pad.length < width || typeof x !== 'object' || x === null) { return flat }
    const inner = `${pad}  `
    return x instanceof Array
        ? `[\n${x.map(y => `${inner}${compact(y, inner, width)},\n`).join('')}${pad}]`
        : `{\n${Object.entries(x).map(([k, y]) => `${inner}${text(k)}: ${compact(y, inner, width)},\n`).join('')}${pad}}`
}

if (which === undefined) {
    const short = x => { const flat = text(x); return flat.length > 150 ? `${flat.slice(0, 150)} …` : flat }
    fast.statements.forEach(statement => console.log(short(statement)))
    console.log(`exit: ${short(fast.exit)}`)
    process.exit(0)
}

/** Every function of the module, by the index of its target. */
const functions = new Map()
const walk = x => {
    if (typeof x !== 'object' || x === null) { return }
    if (x instanceof Array && x[0] === 'function' && x[1]?.target !== undefined) { functions.set(x[1].target.index, x[1]) }
    Object.values(x).forEach(walk)
}
walk(fast)
/** The exports are the entries of the object that the module yields. */
const exported = fast.exit[0] === 'yield' && fast.exit[1][0]?.[0] === 'object'
    ? new Map(fast.exit[1][0][1].filter(entry => entry[0] === ':' && entry[2][0] === 'ref').map(([, name, [, binding]]) => [name, binding.index]))
    : new Map()
const index = exported.get(which) ?? Number(which)
const found = functions.get(index)
if (found === undefined) {
    console.error(`no function ${which}; the module has ${[...functions.keys()].join(', ')}, and exports ${[...exported.keys()].join(', ')}`)
    process.exit(1)
}
console.log(compact(found))
