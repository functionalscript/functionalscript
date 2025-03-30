import { todo } from './module.f.ts'

export default {
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
            constructor: void 0
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
    }
}
