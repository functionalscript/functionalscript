import { printer, primitive, union } from './module.f.ts'

const ro = printer()
const mut = printer(true)

export default {
    primitive: {
        null: () => {
            const r = primitive(null)
            if (r !== 'null') { throw r }
        },
        bigint: () => {
            const r = primitive(42n)
            if (r !== '42n') { throw r }
        },
        string: () => {
            const r = primitive('hello')
            if (r !== '"hello"') { throw r }
        },
        number: {
            finite: () => {
                const r = primitive(3.14)
                if (r !== '3.14') { throw r }
            },
            infinite: () => {
                const r = primitive(Infinity)
                if (r !== 'number') { throw r }
            },
        },
        undefined: () => {
            const r = primitive(undefined)
            if (r !== 'undefined') { throw r }
        },
        boolean: () => {
            const r = primitive(true)
            if (r !== 'true') { throw r }
        },
    },
    union: {
        empty: () => {
            const r = union([])
            if (r !== 'never') { throw r }
        },
        single: () => {
            const r = union(['string'])
            if (r !== 'string') { throw r }
        },
        multi: () => {
            const r = union(['string', 'number'])
            if (r !== 'string|number') { throw r }
        },
    },
    printer: {
        readonly: {
            tuple: () => {
                const r = ro.tuple(['string', 'number'])
                if (r !== 'readonly[string,number]') { throw r }
            },
            struct: () => {
                const r = ro.struct([['x', 'number'], ['y', 'string']])
                if (r !== '{readonly"x":number,readonly"y":string}') { throw r }
            },
            array: () => {
                const r = ro.array('string')
                if (r !== 'readonly(string)[]') { throw r }
            },
            record: () => {
                const r = ro.record('number')
                if (r !== '{readonly[k:string]:number}') { throw r }
            },
        },
        mutable: {
            tuple: () => {
                const r = mut.tuple(['string', 'number'])
                if (r !== '[string,number]') { throw r }
            },
            struct: () => {
                const r = mut.struct([['x', 'number']])
                if (r !== '{"x":number}') { throw r }
            },
            array: () => {
                const r = mut.array('string')
                if (r !== '(string)[]') { throw r }
            },
            record: () => {
                const r = mut.record('number')
                if (r !== '{[k:string]:number}') { throw r }
            },
        },
    },
}
