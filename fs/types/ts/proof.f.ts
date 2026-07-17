import type { Assert } from '../../asserts/module.f.ts'
import { printer, primitive, union, type Equal } from './module.f.ts'
import { assert } from '../../asserts/module.f.ts'

const ro = printer()
const mut = printer(true)

export const primitiveNull = () => {
    const r = primitive(null)
    assert(r === 'null', r)
}

export const primitiveBigint = () => {
    const r = primitive(42n)
    assert(r === '42n', r)
}

export const primitiveString = () => {
    const r = primitive('hello')
    assert(r === '"hello"', r)
}

export const primitiveNumberFinite = () => {
    const r = primitive(3.14)
    assert(r === '3.14', r)
}

export const primitiveNumberInfinite = () => {
    const r = primitive(Infinity)
    assert(r === 'number', r)
}

export const primitiveUndefined = () => {
    const r = primitive(undefined)
    assert(r === 'undefined', r)
}

export const primitiveBoolean = () => {
    const r = primitive(true)
    assert(r === 'true', r)
}

export const unionEmpty = () => {
    const r = union([])
    assert(r === 'never', r)
}

export const unionSingle = () => {
    const r = union(['string'])
    assert(r === 'string', r)
}

export const unionMulti = () => {
    const r = union(['string', 'number'])
    assert(r === 'string|number', r)
}

export const printerReadonlyTuple = () => {
    const r = ro.tuple(['string', 'number'])
    assert(r === 'readonly[string,number]', r)
}

export const printerReadonlyStruct = () => {
    const r = ro.struct([['x', 'number'], ['y', 'string']])
    if (r !== '{readonly"x":number,readonly"y":string}') { throw r }
}

export const printerReadonlyArray = () => {
    const r = ro.array('string')
    assert(r === 'readonly(string)[]', r)
}

export const printerReadonlyRecord = () => {
    const r = ro.record('number')
    if (r !== '{readonly[k in string]?:number}') { throw r }
}

export const printerMutableTuple = () => {
    const r = mut.tuple(['string', 'number'])
    assert(r === '[string,number]', r)
}

export const printerMutableStruct = () => {
    const r = mut.struct([['x', 'number']])
    if (r !== '{"x":number}') { throw r }
}

export const printerMutableArray = () => {
    const r = mut.array('string')
    assert(r === '(string)[]', r)
}

export const printerMutableRecord = () => {
    const r = mut.record('number')
    if (r !== '{[k in string]?:number}') { throw r }
}

export const proof = { primitiveNull,primitiveBigint,primitiveString,primitiveNumberFinite,primitiveNumberInfinite,primitiveUndefined,primitiveBoolean,unionEmpty,unionSingle,unionMulti,printerReadonlyTuple,printerReadonlyStruct,printerReadonlyArray,printerReadonlyRecord,printerMutableTuple,printerMutableStruct,printerMutableArray,printerMutableRecord }

// Don't use!

type T0 = {[k:string]: bigint}

declare const x0: T0

type X0 = Assert<Equal<typeof x0['hello'], bigint>>

// Use for finite sets

type T1 = {[k in 'hello']: bigint}

declare const x1: T1

type X1 = Assert<Equal<typeof x1['hello'], bigint>>

// Don't use it

type T2 = {[k in string]: bigint}

declare const x2: T2

type X2 = Assert<Equal<typeof x2['hello'], bigint>>

// Use it for infinite sets

type T3 = {[k in string]?: bigint}

declare const x3: T3

type X3 = Assert<Equal<typeof x3['hello'], bigint | undefined>>

// type T4 = {[k:string]?: bigint} //< compilation error.
