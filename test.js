// const i = require('./index.js')

require('./types/list/test.js')
require('./types/array/test.js')
require('./types/btree/test.js')
require('./sha2/test.js')
require('./json/test.js')
require('./json/tokenizer/test.js')
require('./types/object/test.js')
require('./io/commonjs/test.js')
require('./commonjs/package/dependencies/test.js')
require('./commonjs/package/test.js')
require('./commonjs/path/test.js')
require('./types/function/compare/test.js')
require('./types/stringSet/test.js')
require('./commonjs/build/test.js')
require('./types/range/test.js')
require('./html/test.js')

/** @type {() => never} */
const assert = () => { throw 'assert' }

/** @type {(_: boolean) => void} */
const assert_if = c => { if (c) { throw 'assert_if' } }

{
    const c = (()=>{})['constructor']
    const f = c('return 5')
    const result = f()
    if (result !== 5) { throw 'function' }
}

{
    /** @type {any} */
    const o = {}
    const c = o['constructor']
    // console.log(c)
    // console.log(c(()=>{}))
}

{
    /** @type {any} */
    const o = {
        constructor: undefined
    }
    const c = o['constructor']
    //console.log(c)
}

{
    /** @type {any} */
    const b = '42'
    const r = Number(b)
    //console.log(r)
}

{
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
}

{
    const x = { 'a': 12 }
    const c = Object.getOwnPropertyDescriptor(x, 'constructor')
    const a = Object.getOwnPropertyDescriptor(x, 'a')
}