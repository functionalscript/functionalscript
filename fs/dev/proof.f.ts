import { todo, env } from './module.f.ts'

export const proof = {
    shouldPass: () => ({
        then: () => undefined
    }),
    ctor: () => {
        const c = (() => { })['constructor']
        const f = c('return 5')
        const result = f()
        if (result !== 5) { throw 'function' }
    },
    ctorEmpty: () => {
        /** @type {any} */
        const o = {}
        const c = o['constructor']
        // console.log(c)
        // console.log(c(()=>{}))
    },
    ctorUndefined: () => {
        /** @type {any} */
        const o = {
            constructor: undefined
        }
        const c = o['constructor']
        //console.log(c)
    },
    number: () => {
        /** @type {any} */
        const b = '42'
        const r = Number(b)
        //console.log(r)
    },
    properties: () => {
        /** @type {any} */
        const o = {}
        //const c = o['constructor']
        //const c = o['__proto__']
        //const c = o['__defineGetter__']
        //const c = o['__defineSetter__']
        //const c = o['__lookupGetter__']
        //const c = o['__lookupSetter__']
        //const c = o['hasOwnProperty']
        //const c = o['isPrototypeOf']
        //const c = o['propertyIsEnumerable']
        //const c = o['toString']
        const c = o['valueOf']
        //console.log(c)
    },
    getOwnPropertyDescriptor: () => {
        const x = { 'a': 12 }
        const c = Object.getOwnPropertyDescriptor(x, 'constructor')
        const a = Object.getOwnPropertyDescriptor(x, 'a')
    },
    throw: () => {
        todo()
    },
    env: () => {
        const mockIo = { process: { env: { MY_VAR: 'hello' } } } as any
        // missing key → undefined
        const r1 = env(mockIo)('MISSING')
        if (r1 !== undefined) { throw r1 }
        // regular value property → returns value
        const r2 = env(mockIo)('MY_VAR')
        if (r2 !== 'hello') { throw r2 }
        // getter property → calls get()
        const envWithGetter = Object.defineProperty({}, 'GETTER_VAR', { get: () => 'from-getter', enumerable: true, configurable: true })
        const mockIo2 = { process: { env: envWithGetter } } as any
        const r3 = env(mockIo2)('GETTER_VAR')
        if (r3 !== 'from-getter') { throw r3 }
    }
}
