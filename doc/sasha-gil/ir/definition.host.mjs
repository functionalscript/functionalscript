// @ts-nocheck
// A small JavaScript host for a WASM module in import form: the `fjs:l0`
// imports that definition.samples.mjs uses, under their ABI names
// (doc/sasha-gil/wasm/l0-design.md), and one native row of `fjs:l1`.
//
// It counts. Every value is a cell with a reference count behind an `i64`
// handle, numbers too, so a `dup` or a `drop` that the lifetime pass
// misplaces shows up: a handle used after its count reached zero is an
// error, and `live()` tells how many cells are left. The four constants
// are immortal. It accompanies definition.check.mjs and is not a runtime.

/** Defined behaviour of a program: a misuse that L0 answers with a trap. */
export class Trap extends Error {}

const KINDS = ['undefined', 'null', 'boolean', 'number', 'string', 'bigint', 'array', 'object', 'function']

export const host = () => {
    const cells = new Map()
    const builders = new Map()
    const immortal = new Map([[1n, undefined], [2n, null], [3n, true], [4n, false]])
    const state = { next: 0x10n, builder: 1, instance: null, thrown: null }
    const trap = (name, reason) => { throw new Trap(`l0.${name}: ${reason}`) }

    const alloc = value => { const h = state.next++; cells.set(h, { value, count: 1 }); return h }
    const cell = h => cells.get(h) ?? (() => { throw new Error(`a value is used after it was freed: handle ${h}`) })()
    const read = h => immortal.has(h) ? immortal.get(h) : cell(h).value
    const kindOf = x => x === undefined ? 0 : x === null ? 1 : typeof x === 'boolean' ? 2 : typeof x === 'number' ? 3
        : typeof x === 'string' ? 4 : typeof x === 'bigint' ? 5 : x.array !== undefined ? 6 : x.object !== undefined ? 7 : 8
    const as = (name, h, kind) => { const x = read(h); return KINDS[kindOf(x)] === kind ? x : trap(name, `not ${kind}`) }
    const dup = h => { if (!immortal.has(h)) { cell(h).count++ } return h }
    const drop = h => {
        if (immortal.has(h)) { return }
        const c = cell(h)
        if (--c.count > 0) { return }
        cells.delete(h)
        // a value owns what it holds
        const x = c.value
        if (typeof x === 'object') { [...(x.array ?? []), ...(x.object ?? []).map(([, v]) => v), ...(x.code === undefined ? [] : [x.frame, x.text])].forEach(drop) }
    }
    const index = (name, i, n) => i >>> 0 < n ? i >>> 0 : trap(name, 'not an index')
    const words = b => { let n = 0; for (let rest = b < 0n ? -b : b; rest !== 0n; rest >>= 64n) { n++ } return n }
    const builder = (name, b) => builders.get(b) ?? trap(name, 'not an open builder')
    const constant = h => new WebAssembly.Global({ value: 'i64', mutable: false }, h)

    const l0 = {
        undefined: constant(1n), null: constant(2n), true: constant(3n), false: constant(4n),
        kind: v => kindOf(read(v)),
        to_f64: v => as('to_f64', v, 'number'),
        from_f64: x => alloc(x),
        to_bool: v => as('to_bool', v, 'boolean') ? 1 : 0,
        from_bool: b => b !== 0 ? 3n : 4n,
        dup,
        drop,
        make_string: (ptr, len) => alloc(String.fromCharCode(...new Uint16Array(state.instance.exports.memory.buffer, ptr, len))),
        unit: (s, i) => { const x = as('unit', s, 'string'); return x.charCodeAt(index('unit', i, x.length)) },
        length: v => {
            const x = read(v)
            switch (KINDS[kindOf(x)]) {
                case 'string': return x.length
                case 'bigint': return words(x)
                case 'array': return x.array.length
                case 'object': return x.object.length
                case 'function': return x.length
                default: return trap('length', 'no length')
            }
        },
        // a builder owns what is pushed into it, and `seal` hands that to the array
        begin_array: n => { builders.set(state.builder, { items: [], n }); return state.builder++ },
        push: (b, v) => { const x = builder('push', b); x.items.length < x.n ? x.items.push(v) : trap('push', 'more items than declared') },
        seal: b => { const x = builder('seal', b); builders.delete(b); return x.items.length === x.n ? alloc({ array: x.items }) : trap('seal', 'fewer items than declared') },
        item: (v, i) => { const x = as('item', v, 'array').array; return dup(x[index('item', i, x.length)]) },
        // `make_function` takes its frame and its text
        make_function: (code, frame, length, text) => alloc({ code, frame, length, text }),
        call: (f, args) => { as('call', args, 'array'); return state.instance.exports.table.get(as('call', f, 'function').code)(f, args) },
        frame: (self, i) => { const x = as('frame', as('frame', self, 'function').frame, 'array').array; return dup(x[index('frame', i, x.length)]) },
        throw: v => { state.thrown = dup(v); throw new Trap('thrown') },
    }
    // one native row of L1, enough for a program that adds
    const l1 = {
        add: (a, b) => {
            const [x, y] = [read(a), read(b)]
            return typeof x === typeof y && (typeof x === 'number' || typeof x === 'string') ? alloc(x + y) : trap('add', 'this host adds two numbers or two strings')
        },
    }

    /** A JavaScript value as a handle that the caller owns. */
    const fromJs = x => x === undefined ? 1n : x === null ? 2n : x === true ? 3n : x === false ? 4n
        : x instanceof Array ? alloc({ array: x.map(fromJs) })
        : typeof x === 'object' ? alloc({ object: Object.entries(x).map(([k, v]) => [k, fromJs(v)]) })
        : alloc(x)
    /** The JavaScript value behind a handle; a function stays a handle's cell. */
    const toJs = h => {
        const x = read(h)
        return typeof x !== 'object' || x === null ? x : x.array !== undefined ? x.array.map(toJs)
            : x.object !== undefined ? Object.fromEntries(x.object.map(([k, v]) => [k, toJs(v)])) : x
    }
    return {
        imports: { 'fjs:l0': l0, 'fjs:l1': l1 },
        attach: instance => { state.instance = instance },
        fromJs, toJs, drop,
        /** The cells and open builders that are alive now. */
        live: () => cells.size + builders.size,
    }
}
