import { printer, primitive, union } from './module.f.ts'

const ro = printer()
const mut = printer(true)

export const primitiveNull = () => {
    const r = primitive(null)
    if (r !== 'null') { throw r }
}

export const primitiveBigint = () => {
    const r = primitive(42n)
    if (r !== '42n') { throw r }
}

export const primitiveString = () => {
    const r = primitive('hello')
    if (r !== '"hello"') { throw r }
}

export const primitiveNumberFinite = () => {
    const r = primitive(3.14)
    if (r !== '3.14') { throw r }
}

export const primitiveNumberInfinite = () => {
    const r = primitive(Infinity)
    if (r !== 'number') { throw r }
}

export const primitiveUndefined = () => {
    const r = primitive(undefined)
    if (r !== 'undefined') { throw r }
}

export const primitiveBoolean = () => {
    const r = primitive(true)
    if (r !== 'true') { throw r }
}

export const unionEmpty = () => {
    const r = union([])
    if (r !== 'never') { throw r }
}

export const unionSingle = () => {
    const r = union(['string'])
    if (r !== 'string') { throw r }
}

export const unionMulti = () => {
    const r = union(['string', 'number'])
    if (r !== 'string|number') { throw r }
}

export const printerReadonlyTuple = () => {
    const r = ro.tuple(['string', 'number'])
    if (r !== 'readonly[string,number]') { throw r }
}

export const printerReadonlyStruct = () => {
    const r = ro.struct([['x', 'number'], ['y', 'string']])
    if (r !== '{readonly"x":number,readonly"y":string}') { throw r }
}

export const printerReadonlyArray = () => {
    const r = ro.array('string')
    if (r !== 'readonly(string)[]') { throw r }
}

export const printerReadonlyRecord = () => {
    const r = ro.record('number')
    if (r !== '{readonly[k:string]:number}') { throw r }
}

export const printerMutableTuple = () => {
    const r = mut.tuple(['string', 'number'])
    if (r !== '[string,number]') { throw r }
}

export const printerMutableStruct = () => {
    const r = mut.struct([['x', 'number']])
    if (r !== '{"x":number}') { throw r }
}

export const printerMutableArray = () => {
    const r = mut.array('string')
    if (r !== '(string)[]') { throw r }
}

export const printerMutableRecord = () => {
    const r = mut.record('number')
    if (r !== '{[k:string]:number}') { throw r }
}
