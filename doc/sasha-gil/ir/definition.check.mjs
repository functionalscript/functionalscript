// @ts-nocheck
// The check of doc/sasha-gil/ir/definition.md. It takes the samples of
// definition.samples.mjs through the checker, the lifetime pass and the
// WASM emitter, runs the module under Node on the counting host, and
// compares every answer with the FunctionalScript original.
//
//     node definition.check.mjs              the check, with a summary
//     node definition.check.mjs ir typeOf    a function as written, and in the owned stage
//     node definition.check.mjs wat typeOf   its WAT, from fjs/media/wasm's writer
//
// It is a prototype, not part of the build, and it is plain JavaScript
// without types, so it opts out of the tsconfig's check above.

import { check, print, Refused } from './definition.ir.mjs'
import { lifetime } from './definition.lifetime.mjs'
import { emit } from './definition.wasm.mjs'
import { host, Trap } from './definition.host.mjs'
import { exported, mistakes, refusals, sample } from './definition.samples.mjs'
import { write } from '../../../fjs/media/wasm/binary/write/module.f.mjs'
import { functions as watFunctions } from '../../../fjs/media/wasm/wat/module.f.mjs'
import * as l1 from '../../../fjs/wasm/runtime/l1/module.f.js'

const owned = lifetime(sample)
const [, , command, ...names] = process.argv

if (command === 'ir') {
    console.log(`// as written\n\n${print(sample, names)}`)
    console.log(`// the owned stage\n\n${print(owned, names)}`)
    process.exit(0)
}

/** A module, emitted and running on a fresh host. */
const run = module => {
    const checked = check(module)
    const ast = emit(checked, exported)
    const h = host()
    const instance = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(write(ast))), h.imports)
    h.attach(instance)
    instance.exports.init()
    return { checked, ast, h, f: instance.exports }
}

if (command === 'wat') {
    const { ast, checked } = run(owned)
    const all = watFunctions(ast)
    const defined = [...Object.keys(checked.module.functions), 'init']
    names.forEach(name => console.log(all[all.length - defined.length + defined.indexOf(name)]))
    process.exit(0)
}

const problems = []
const expect = (what, ok) => { if (!ok) { problems.push(what) } }
/** A trap is an answer. Anything else the host throws is a mistake of the code under test. */
const outcome = f => {
    try { return ['ok', f()] } catch (e) {
        return e instanceof Trap || e instanceof WebAssembly.RuntimeError ? ['fails'] : ['the host objects', e.message]
    }
}
const original = f => { try { return ['ok', f()] } catch { return ['fails'] } }
const show = x => typeof x === 'bigint' ? `${x}n` : typeof x === 'object' && x !== null ? JSON.stringify(x, (_, y) => typeof y === 'bigint' ? `${y}n` : y) : String(x)
const same = (a, b) => Object.is(a, b) || (typeof a === 'object' && typeof b === 'object' && show(a) === show(b))

const { ast, h, f } = run(owned)
const l0 = h.imports['fjs:l0']
let baseline = h.live()
let cases = 0

/**
 * One call of an export on JavaScript values. `result` reads the answer, a
 * handle or a number, and says whether the caller owns it.
 */
const call = (name, args, expected, result) => {
    cases++
    // an argument is a value behind a handle, or a plain integer
    const handles = args.map(x => typeof x === 'object' && x !== null && x.int !== undefined ? x.int : h.fromJs(x))
    const got = outcome(() => {
        const r = f[name](...handles)
        const value = result.read(r)
        if (result.owned) { h.drop(r) }
        return value
    })
    handles.forEach(x => { if (typeof x === 'bigint') { h.drop(x) } })
    expect(`${name}(${args.map(show).join(', ')}): ${got.map(show)} is not ${expected.map(show)}`, got[0] === expected[0] && same(got[1], expected[1]))
    // a trap abandons its frames, and what they owned is the host's `recover` to free
    if (got[0] === 'fails') { baseline = h.live() }
    expect(`${name}(${args.map(show).join(', ')}): ${h.live() - baseline} values are left over`, h.live() === baseline)
}
const value = { read: h.toJs, owned: true }
const flag = { read: r => r !== 0, owned: false }

const values = [undefined, null, true, false, 0, -0, NaN, 1, -1.5, Infinity, '', 'a', 'abc', 0n, 5n, -(1n << 70n), [], [1, 'x'], {}, { a: 1 }]
const strings = ['', 'a', 'b', 'ab', 'abc', 'abd', 'abcd', '\u0000', 'é', '😀', '😀x']

values.forEach(v => call('typeOf', [v], original(() => l1.typeOf(v)), value))
values.forEach(v => call('toBoolean', [v], original(() => l1.toBoolean(v)), flag))
for (const name of ['stringEquals', 'stringEqualsF']) {
    strings.forEach(a => strings.forEach(b => call(name, [a, b], original(() => l1.stringEquals(a, b)), value)))
    // a misuse traps where the original throws
    ;[[1, 'a'], ['a', undefined], [[], 'a'], [null, null]].forEach(([a, b]) => call(name, [a, b], original(() => l1.stringEquals(a, b)), value))
}

// an optional chain: a link without a receiver leaves the block, also while the block owns a value
const chain = a => a?.[0]?.[0]
;[undefined, null, [], [undefined], [null], [[]], [[1]], [['x', 2], 3], [[[4]]]].forEach(a => call('chain', [a], original(() => chain(a)), value))
// a receiver of another kind is the member read's business, which this sample leaves out
;[7, [7], 'ab'].forEach(a => call('chain', [a], ['fails'], value))

// a loop that owns its state
const repeat = (s, count) => { let r = ''; for (let i = 0; i < count; i++) { r = r + s } return r }
;[['ab', 0], ['ab', 1], ['ab', 3], ['', 5], ['😀', 2]].forEach(([s, count]) => call('repeat', [s, { int: count }], original(() => repeat(s, count)), value))
call('repeat', [true, { int: 2 }], ['fails'], value)

// the program: a function value made by `adder`, called through L0's `call`
const adder = a => b => a + b
for (const [a, list] of [[2, [3]], ['a', ['b']], [2, [3, 9]], [0.5, [NaN]]]) {
    cases++
    const [ha, hargs] = [h.fromJs(a), h.fromJs(list)]
    const fnValue = f.adder(ha)
    const r = l0.call(fnValue, hargs)
    expect(`adder(${a})(${list}): ${h.toJs(r)}`, same(h.toJs(r), adder(a)(...list)))
    expect('a function value is a function', h.toJs(f.typeOf(fnValue)) === 'function' && f.toBoolean(fnValue) === 1)
    ;[r, fnValue, hargs, ha].forEach(h.drop)
    expect(`adder(${a})(${list}): ${h.live() - baseline} values are left over`, h.live() === baseline)
}

// the checker and the lifetime pass refuse each mistake
const refusedBy = module => {
    try { check(module) } catch (e) { if (e instanceof Refused) { return 'checker' } throw e }
    try { lifetime(module) } catch (e) { if (e instanceof Refused) { return 'lifetime pass' } throw e }
    return 'nobody'
}
mistakes.forEach(([what, module, who]) => expect(`${what}: refused by ${refusedBy(module)}, not by the ${who}`, refusedBy(module) === who))

// what the prototype cannot take, and a name that is taken, are refused as well
const taken = module => {
    // only what the module has is exported, so that a missing export is not what refuses it
    const has = exported.filter(name => Object.hasOwn(module.functions, name))
    try { emit(check(lifetime(module)), has) } catch (e) { if (e instanceof Refused) { return false } throw e }
    return true
}
refusals.forEach(([what, module]) => expect(`${what}: taken, where it has to be refused`, !taken(module)))

// the counting host has teeth: the plain stage, with no `dup` and no `drop`, does not get through
const withoutPass = () => {
    const plain = run(sample)
    const before = plain.h.live()
    try {
        const ha = plain.h.fromJs(2)
        const hargs = plain.h.fromJs([3])
        const fnValue = plain.f.adder(ha)
        const r = plain.h.imports['fjs:l0'].call(fnValue, hargs)
        ;[r, fnValue, hargs, ha].forEach(plain.h.drop)
    } catch (e) {
        return e instanceof Trap || e instanceof WebAssembly.RuntimeError ? 'a trap' : 'a value used after it was freed'
    }
    return plain.h.live() === before ? 'nothing' : 'values left over'
}
const caught = withoutPass()
expect('the plain stage ran on the counting host without a complaint', caught !== 'nothing')

const failing = Object.entries(check(sample).module.functions).filter(([, fun]) => fun.fails).map(([name]) => name)
console.log(`${cases} calls agree with the FunctionalScript originals, and no value is left over after any of them`)
console.log(`${mistakes.length} mistakes are refused, ${mistakes.filter(([, , who]) => who === 'checker').length} by the checker and ${mistakes.filter(([, , who]) => who !== 'checker').length} by the lifetime pass`)
console.log(`${refusals.length} modules that the prototype does not take are refused`)
console.log(`without the lifetime pass the host reports ${caught}`)
console.log(`may fail: ${failing.join(', ')}`)
console.log(`the module: ${ast.imports.length} imports, ${ast.functions.length} functions, ${write(ast).length} bytes`)
if (problems.length > 0) {
    console.log(`\n${problems.length} problems:\n${problems.join('\n')}`)
    process.exit(1)
}
