const stringCoercion = String

export default {
    stringCoercion: {
        number: () => {
            if (stringCoercion(123) !== '123') { throw [123, 'toString', '123'] }
            if (stringCoercion(-456) !== '-456') { throw [-456, 'toString', '-456'] }
            if (stringCoercion(0) !== '0') { throw [0, 'toString', '0'] }
            if (stringCoercion(-0) !== '0') { throw [0, 'toString', '0'] }
            if (stringCoercion(1/(-0)) !== '-Infinity') { throw [0, 'toString', '-Infinity'] }
            if (stringCoercion(Infinity) !== 'Infinity') { throw [Infinity, 'toString', 'Infinity'] }
            if (stringCoercion(-Infinity) !== '-Infinity') { throw [-Infinity, 'toString', '-Infinity'] }
            if (stringCoercion(1/-Infinity) !== '0') { throw [-Infinity, 'toString', '0'] }
            if (stringCoercion(NaN) !== 'NaN') { throw [NaN, 'toString', 'NaN'] }
        },
        bool: () => {
            if (stringCoercion(true) !== 'true') { throw [true, 'toString', 'true'] }
            if (stringCoercion(false) !== 'false') { throw [false, 'toString', 'false'] }
        },
        null: () => {
            if (stringCoercion(null) !== 'null') { throw [null, 'toString', 'null'] }
        },
        undefined: () => {
            if (stringCoercion(undefined) !== 'undefined') { throw [undefined, 'toString', 'undefined'] }
        },
        bigint: () => {
            if (stringCoercion(123n) !== '123') { throw [123n, 'toString', '123'] }
            if (stringCoercion(-456n) !== '-456') { throw [-456n, 'toString', '-456'] }
        },
        array: () => {
            const arr = [1, 2, 3]
            if (stringCoercion(arr) !== '1,2,3') { throw [arr, 'toString', '1,2,3'] }
        },
        func: () => {
            const func = () => 5
            if (typeof stringCoercion(func) !== 'string') { throw [func, 'toString'] }
            // if (stringCoercion(func) !== '() => 5') { throw [func, 'toString', 'function result'] }
        },
        object: {
            norm: () => {
                const obj = { a: 1, b: 2 }
                if (stringCoercion(obj) !== '[object Object]') { throw [obj, 'toString', '[object Object]'] }
            },
            toString: () => {
                const x = { toString: () => 'custom string' }
                if (stringCoercion(x) !== 'custom string') { throw [x, 'toString', 'custom string'] }
            },
            toStringThrow: {
                throw: () => {
                    const x = { toString: () => { throw new Error('Custom error') } }
                    stringCoercion(x)
                }
            },
            toStringNotFunc: {
                throw: () => {
                    const x = { toString: 'hello' }
                    stringCoercion(x)
                }
            },
            toStringNonPrimitive: {
                throw: () => {
                    const x = { toString: () => [] }
                    stringCoercion(x)
                }
            }
        }
    }
}
