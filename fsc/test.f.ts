import * as _ from './module.f.ts'
import * as ascii from '../text/ascii/module.f.ts'
const { one } = ascii
import * as j from '../json/module.f.ts'
const { stringify } = j
const s = stringify(i => i)

const f
    : (v: string) => string
    = v => {
    const n = one(v)
    return s(_.init(n)[0])
}

// this doesn't change a name of the function
const fn = (f: () => undefined, name: string) => ({[name]: f}[name])

const withName = (name: string): () => undefined =>
    // translated into one command: define a `function [name]() { return undefined }`
    (Object.getOwnPropertyDescriptor({[name]: () => undefined}, name) as any).value

export default {
    a: () => {
        const x = f('1')
        if (x !== '["1"]') { throw x }
    },
    fn: () => {
        const o = {
            ["hello world!"]: () => undefined
        }
        const f = o["hello world!"]
        const { name } = f
        if (name !== "hello world!") { throw name }
        //
        const f1 = { ["boring"]: () => undefined }["boring"]
        if (f1.name !== "boring") { throw f1.name }
        //
        const x = fn(() => undefined, "hello").name
        if (x !== "") { throw x }
        //
        const m = withName("boring2").name
        if (m !== "boring2") { throw m }
        //
        const a = function x() { return undefined }
        if (a.name !== "x") { throw a.name }
    },
    //
    f1: () => {
        const m1 = () => undefined
        if (m1.name !== "m1") { throw m1.name }
    },
    //
    f2: () => {
        const m11 = (() => undefined)
        if (m11.name !== "m11") { throw m11.name }
    },
    //
    f3: () => {
        const m2: any = true ? () => undefined : () => undefined
        // for `bun` it is `m2`:
        // if (m2.name !== "") { throw m2.name }
    },
    f4: () => {
        const id = <T>(i: T): T => i
        const f: any = id(() => undefined)
        // for `bun` it is `m2`:
        if (f.name !== "") { throw f.name }
    }
}
