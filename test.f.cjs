const i = require('./module.f.cjs')

require('./types/list/test.f.cjs')
require('./types/number/test.f.cjs')
require('./types/bigint/module.f.cjs')
require('./types/array/test.f.cjs')
require('./types/btree/test.f.cjs')
require('./types/byteSet/test.f.cjs')
require('./types/nibbleSet/test.f.cjs')
require('./sha2/test.f.cjs')
require('./json/test.f.cjs')
require('./types/string/test.f.cjs')
require('./json/tokenizer/test.f.cjs')
require('./types/object/test.f.cjs')
require('./commonjs/test.cjs')
require('./commonjs/package/dependencies/test.f.cjs')
require('./commonjs/package/test.f.cjs')
require('./commonjs/path/test.f.cjs')
require('./types/function/test.f.cjs')
require('./types/function/compare/test.f.cjs')
require('./types/stringset/test.f.cjs')
require('./types/option/test.f.cjs')
require('./commonjs/build/test.f.cjs')
require('./types/range/test.f.cjs')
require('./html/test.f.cjs')
require('./text/test.f.cjs')
require('./text/utf8/test.f.cjs')
require('./text/utf16/test.f.cjs')
require('./com/cs/test.f.cjs')
require('./com/cpp/test.f.cjs')
require('./nodejs/version/test.f.cjs')
require('./com/rust/test.f.cjs')

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