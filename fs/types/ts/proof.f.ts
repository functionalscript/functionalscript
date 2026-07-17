import type { Assert } from '../../asserts/module.f.ts'
import { printer, primitive, union, type Equal } from './module.f.ts'
import { assertEq } from '../../asserts/module.f.ts'

const ro = printer()
const mut = printer(true)

export const primitiveNull = () => {
    const r = primitive(null)
    assertEq(r, 'null')
}

export const primitiveBigint = () => {
    const r = primitive(42n)
    assertEq(r, '42n')
}

export const primitiveString = () => {
    const r = primitive('hello')
    assertEq(r, '"hello"')
}

export const primitiveNumberFinite = () => {
    const r = primitive(3.14)
    assertEq(r, '3.14')
}

export const primitiveNumberInfinite = () => {
    const r = primitive(Infinity)
    assertEq(r, 'number')
}

export const primitiveUndefined = () => {
    const r = primitive(undefined)
    assertEq(r, 'undefined')
}

export const primitiveBoolean = () => {
    const r = primitive(true)
    assertEq(r, 'true')
}

export const unionEmpty = () => {
    const r = union([])
    assertEq(r, 'never')
}

export const unionSingle = () => {
    const r = union(['string'])
    assertEq(r, 'string')
}

export const unionMulti = () => {
    const r = union(['string', 'number'])
    assertEq(r, 'string|number')
}

export const printerReadonlyTuple = () => {
    const r = ro.tuple(['string', 'number'])
    assertEq(r, 'readonly[string,number]')
}

export const printerReadonlyStruct = () => {
    const r = ro.struct([['x', 'number'], ['y', 'string']])
    if (r !== '{readonly"x":number,readonly"y":string}') { throw r }
}

export const printerReadonlyArray = () => {
    const r = ro.array('string')
    assertEq(r, 'readonly(string)[]')
}

export const printerReadonlyRecord = () => {
    const r = ro.record('number')
    if (r !== '{readonly[k in string]?:number}') { throw r }
}

export const printerMutableTuple = () => {
    const r = mut.tuple(['string', 'number'])
    assertEq(r, '[string,number]')
}

export const printerMutableStruct = () => {
    const r = mut.struct([['x', 'number']])
    if (r !== '{"x":number}') { throw r }
}

export const printerMutableArray = () => {
    const r = mut.array('string')
    assertEq(r, '(string)[]')
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
