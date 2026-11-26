// @ts-nocheck
// The benchmark of benchmark.md: lowers benchmark.programs.mjs with no
// signature table, links the bodies of L1 that they reach, and times each
// program as WASM on NaNVM's .wasm and on the counting host, beside the
// program itself as JavaScript runs it. benchmark.typed.mjs is lowered with
// `n: f64` and timed as plain WASM. It is a prototype, not part of the build.
//
// Build NaNVM's .wasm first, from the repository's root:
//
//   cargo build -p nanvm-l0-wasm --release --target wasm32-unknown-unknown
//
// Then, from the repository's root:
//
//   node doc/sasha-gil/ir/benchmark.run.mjs              times (emit A, always dyn-ref)
//   node doc/sasha-gil/ir/benchmark.run.mjs table B      times with short emit (variant B)
//   node doc/sasha-gil/ir/benchmark.run.mjs calls B      L0 calls with short emit
//   node doc/sasha-gil/ir/benchmark.run.mjs l0           the cost of one L0 call
//   node --cpu-prof doc/sasha-gil/ir/benchmark.run.mjs nanvm <program> [A|B]
//                                                    one program on NaNVM, 3 s, to profile

import { readFileSync } from 'node:fs'
import { assertOk } from '../../../fjs/asserts/module.f.js'
import { write } from '../../../fjs/media/wasm/binary/write/module.f.js'
import { check } from '../../../fjs/ir/check/module.f.js'
import { lower } from '../../../fjs/ir/from_fast/module.f.js'
import { errorTable } from '../../../fjs/ir/from_fast/link/module.f.js'
import { l1Runtime, l1Whole, sourceOf } from '../../../fjs/ir/from_fast/testlib.f.js'
import { lifetime } from '../../../fjs/ir/lifetime/module.f.js'
import { counting } from '../../../fjs/ir/l0/host/count/module.mjs'
import { nanvmHost } from '../../../fjs/ir/l0/host/nanvm/module.mjs'
import { f64, signature } from '../../../fjs/ir/module.f.js'
import { host as nativeHost } from '../../../fjs/ir/native/host/module.mjs'
import { v1EnabledTags } from '../../../fjs/ir/runtime/string/short.f.js'
import { emit } from '../../../fjs/ir/wasm/module.f.js'
import { layoutOf } from '../../../fjs/ir/wasm/testlib.mjs'
import * as programs from './benchmark.programs.mjs'
import * as typed from './benchmark.typed.mjs'

const here = path => new URL(path, import.meta.url)

/** The module that the lowering makes of a file's text. */
const fromText = (url, table, runtime) => {
    const { fast, imports } = assertOk(sourceOf(readFileSync(url, 'utf8')))
    return assertOk(lower(table, runtime)(fast, imports))
}

/** Checked, emitted and compiled, or a throw of the checker's reason. */
const compile = m => {
    const [tag, checked] = check(m)
    if (tag !== 'ok') { throw new Error(checked) }
    return new WebAssembly.Module(new Uint8Array(write(emit(checked))))
}

const l1Text = here('../../../fjs/wasm/runtime/l1/module.f.js')
const errors = assertOk(errorTable(assertOk(sourceOf(readFileSync(here('../../../fjs/wasm/runtime/l1/error/module.f.js'), 'utf8'))).fast))
const runtime = { ...l1Runtime(errors), l1: fromText(l1Text, l1Whole, l1Runtime(errors)) }
const untyped = compile(assertOk(lifetime(fromText(here('./benchmark.programs.mjs'), {}, runtime))))
const { data, entries } = layoutOf(untyped)
const plain = compile(fromText(here('./benchmark.typed.mjs'), { sumTo: signature([['n', f64]], f64), fib: signature([['n', f64]], f64) }, null))

const nanvm = nanvmHost(new WebAssembly.Module(readFileSync(here('../../../target/wasm32-unknown-unknown/release/nanvm_l0_wasm.wasm'))))

/** Emit A: always dyn-ref (control). Emit B: shortWhenEnabled + v1 tags. */
const emitA = /** @type {const} */ ({ kind: 'alwaysDynRef' })
const emitB = /** @type {const} */ ({ kind: 'shortWhenEnabled', enabledTags: v1EnabledTags })

/** Each program and its arguments: every argument is a value of `any`. */
const cases = [
    ['sumTo', [10_000]],
    ['sumToAny', [10_000]],
    ['fib', [70]],
    ['readFields', [{ x: 2, y: 3 }, 10_000]],
    ['callMany', [(a, b) => a + b, 1_000]],
    ['shortOps', ['a', 10_000]],
    ['repeat', [1_000, '']],
    ['bigSum', [1_000n, 1n]],
]

const argv = process.argv.slice(2)
const mode = argv[0] ?? 'table'
const emitArg = argv.find(a => a === 'A' || a === 'B')
const emitLabel = emitArg ?? 'A'
const stringEmit = emitLabel === 'B' ? emitB : emitA
const only = argv.find(a => a !== mode && a !== 'A' && a !== 'B')

/** Nanoseconds a call of `f` takes: the median of batches of 10, after a warm-up. */
const time = (f, budget = mode === 'table' ? 500 : 3000) => {
    for (let k = 0; k < 20; k += 1) { f() }
    const samples = []
    const end = performance.now() + budget
    while (performance.now() < end) {
        const t0 = performance.now()
        for (let k = 0; k < 10; k += 1) { f() }
        samples.push((performance.now() - t0) / 10)
    }
    samples.sort((a, b) => a - b)
    return samples[samples.length >> 1] * 1e6
}

/** A host whose L0 imports count their calls into `tally`. */
const tallied = (make, tally) => (values, d, e, se) => {
    const h = make(values, d, e, se)
    const imports = Object.fromEntries(Object.entries(h.imports).map(([k, f]) => [k,
        typeof f !== 'function' ? f : (...xs) => {
            tally.set(k, (tally.get(k) ?? 0) + 1)
            return f(...xs)
        }]))
    // Caller cleanup after the export returns is not a program import.
    return { ...h, imports, dropResult: h.imports.drop }
}

/** The program `name` on a host that `make` makes, with `args` as its first values: a call of it, which reads and drops its result. */
const onHost = (make, name, args, se = stringEmit) => {
    const h = make(args, data, entries, se)
    const { exports } = new WebAssembly.Instance(untyped, { 'fjs:l0': h.imports, 'fjs:l1-native': h.native ?? nativeHost(h.read, h.own, h.fail) })
    if (typeof exports.init === 'function') { exports.init() }
    h.keep()
    const dropResult = h.dropResult ?? h.imports.drop
    return () => {
        const r = exports[name](...h.first)
        const v = h.read(r)
        dropResult(r)
        return v
    }
}

const fmt = ns => ns >= 1e6 ? `${(ns / 1e6).toFixed(2)} ms` : ns >= 1e3 ? `${(ns / 1e3).toFixed(1)} µs` : `${ns.toFixed(0)} ns`

const table = () => {
    const { exports } = new WebAssembly.Instance(plain, {})
    console.log(`emit ${emitLabel} (${stringEmit.kind}${emitLabel === 'B' ? `, tags ${v1EnabledTags.join('/')}` : ''})`)
    console.log('| Program | JavaScript | Typed IR as WASM | IR on NaNVM\'s .wasm | IR on the counting host | NaNVM / JavaScript | Counting / NaNVM |')
    console.log('| --- | --- | --- | --- | --- | --- | --- |')
    for (const [name, args] of cases) {
        const expected = programs[name](...args)
        const n = onHost(nanvm, name, args)
        const c = onHost(counting, name, args)
        for (const got of [n(), c()]) {
            if (!Object.is(got, expected)) { throw new Error(`${name}: ${got}, not ${expected}`) }
        }
        const js = time(() => programs[name](...args))
        const tn = time(n)
        const tc = time(c)
        const t = typed[name] === undefined ? '' : (() => {
            if (exports[name](...args) !== typed[name](...args)) { throw new Error(`${name}: typed`) }
            return fmt(time(() => exports[name](...args)))
        })()
        console.log(`| ${name} | ${fmt(js)} | ${t} | ${fmt(tn)} | ${fmt(tc)} | ${(tn / js).toFixed(0)}× | ${(tc / tn).toFixed(1)}× |`)
    }
}

const calls = () => {
    console.log(`emit ${emitLabel} (${stringEmit.kind}${emitLabel === 'B' ? `, tags ${v1EnabledTags.join('/')}` : ''})`)
    console.log('| Program | L0 calls | Most called |')
    console.log('| --- | --- | --- |')
    for (const [name, args] of cases) {
        const tally = new Map()
        onHost(tallied(nanvm, tally), name, args)()
        tally.delete('make_string') // the module's literals, made once
        const total = [...tally.values()].reduce((a, b) => a + b, 0)
        const top = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ')
        console.log(`| ${name} | ${total} | ${top} |`)
    }
}

const l0 = () => {
    const N = 2_000_000
    const t = f => {
        f()
        const t0 = performance.now()
        f()
        return (performance.now() - t0) * 1e6 / N
    }
    console.log('| L0 call, from JavaScript | NaNVM\'s .wasm | Counting host |')
    console.log('| --- | --- | --- |')
    const rows = h => {
        const [num, str, obj] = h.first
        const i = h.imports
        return [
            ['`from_bool(1)`: a constant, the cost of the call alone', () => { for (let k = 0; k < N; k += 1) { i.from_bool(1) } }],
            ['`kind` of a number', () => { for (let k = 0; k < N; k += 1) { i.kind(num) } }],
            ['`kind` of an object', () => { for (let k = 0; k < N; k += 1) { i.kind(obj) } }],
            ['`to_f64`', () => { for (let k = 0; k < N; k += 1) { i.to_f64(num) } }],
            ['`from_f64`, then `drop`', () => { for (let k = 0; k < N; k += 1) { i.drop(i.from_f64(k)) } }],
            ['`dup` of a string, then `drop`', () => { for (let k = 0; k < N; k += 1) { i.drop(i.dup(str)) } }],
        ]
    }
    const values = [1.5, 'abc', { a: 1 }]
    const a = rows(nanvm(values))
    const b = rows(counting(values))
    a.forEach(([k, f], j) => console.log(`| ${k} | ${t(f).toFixed(1)} ns | ${t(b[j][1]).toFixed(1)} ns |`))
}

const profile = () => {
    const found = cases.find(([k]) => k === only)
    if (found === undefined) { throw new Error(`no program ${only}`) }
    console.log(only, `emit ${emitLabel}`, fmt(time(onHost(nanvm, ...found))))
}

const modes = { table, calls, l0, nanvm: profile }
if (modes[mode] === undefined) { throw new Error(`no mode ${mode}`) }
modes[mode]()
