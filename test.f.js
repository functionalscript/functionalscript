const i = require('./main.f.js')

require('./types/list/test.f.js')
require('./types/array/test.f.js')
require('./types/btree/test.f.js')
require('./sha2/test.f.js')
require('./json/test.f.js')
require('./json/tokenizer/test.f.js')
require('./types/object/test.f.js')
require('./io/commonjs/test.js')
require('./commonjs/package/dependencies/test.f.js')
require('./commonjs/package/test.f.js')
require('./commonjs/path/test.f.js')
require('./types/function/compare/test.f.js')
require('./types/stringset/test.f.js')
require('./commonjs/build/test.f.js')
require('./types/range/test.f.js')
require('./html/test.f.js')
require('./text/test.f.js')
require('./com/cs/test.f.js')

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