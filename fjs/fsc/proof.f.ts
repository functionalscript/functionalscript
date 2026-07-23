import { init, terminal } from './module.f.ts'
import { one } from '../text/ascii/module.f.ts'
import { stringify } from '../media/json/module.f.ts'
import { assertEq } from '../asserts/module.f.ts'

const s = stringify(i => i)

const f
    : (v: string) => string
    = v => {
    const n = one(v)
    return s(init(n)[0])
}

// this doesn't change a name of the function
const fn = (f: () => undefined, name: string) => ({[name]: f}[name])

const withName = (name: string): () => undefined =>
    // translated into one command: define a `function [name]() { return undefined }`
    (Object.getOwnPropertyDescriptor({[name]: () => undefined}, name) as any).value

export const proof = {
    a: () => {
        const x = f('1')
        assertEq(x, '["1"]')
    },
    b: () => {
        // exercises toInit: terminal returns empty output and loops back to init
        const result = init(terminal)
        assertEq(result[0].length, 0, result[0])
    },
    c: () => {
        // exercises unexpectedSymbol: next state after a token returns an error message
        const next = init(one('1'))[1]
        const result = next(42)
        assertEq(result[0][0], 'unexpected symbol 42')
    },
    fn: () => {
        const o = {
            ["hello world!"]: () => undefined
        }
        const f = o["hello world!"]
        const { name } = f
        assertEq(name, "hello world!")
        //
        const f1 = { ["boring"]: () => undefined }["boring"]
        assertEq(f1.name, "boring")
        //
        const x = fn(() => undefined, "hello").name
        assertEq(x, "")
        //
        const m = withName("boring2").name
        assertEq(m, "boring2")
        //
        const a = function x() { return undefined }
        assertEq(a.name, "x")
    },
    //
    f1: () => {
        const m1 = () => undefined
        assertEq(m1.name, "m1")
    },
    //
    f2: () => {
        const m11 = (() => undefined)
        assertEq(m11.name, "m11")
    },
    //
    f3: () => {
        const m2: any = true ? () => undefined : () => undefined
        // for `bun` it is `m2`:
        // assertEq(m2.name, "")
        // see also https://github.com/oven-sh/bun/issues/20398
    },
    f4: () => {
        const id = <T>(i: T): T => i
        const f: any = id(() => undefined)
        // for `bun` it is `m2`:
        assertEq(f.name, "")
    },
    chars: {
        whitespace: () => {
            for (const ch of ['\t', ' ', '\n', '\r']) {
                const [tokens, next] = init(one(ch))
                assertEq(tokens.length, 0)
                assertEq(next, init)
            }
        },
        punctuation: () => {
            for (const ch of ['!', '"', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '[', ']', '^', '`', '{', '|', '}', '~']) {
                const [tokens] = init(one(ch))
                assertEq(tokens.length, 1)
                assertEq(tokens[0], ch)
            }
        },
        identifier_start: () => {
            for (const ch of ['$', '_', 'A', 'Z', 'a', 'z']) {
                const [tokens] = init(one(ch))
                assertEq(tokens.length, 1)
                assertEq(tokens[0], ch)
            }
        },
        digits: () => {
            for (const ch of ['0', '5', '9']) {
                const [tokens] = init(one(ch))
                assertEq(tokens.length, 1)
                assertEq(tokens[0], ch)
            }
        },
    },
}
