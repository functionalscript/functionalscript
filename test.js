const i = require('./')

require('./types/list/test')
require('./types/array/test')
require('./types/btree/test')
require('./sha2/test')
require('./json/test')
require('./types/object/test')
require('./io/commonjs/test')
require('./commonjs/package/dependencies/test')
require('./commonjs/package/test')
require('./commonjs/path/test')
require('./types/function/compare/test')
require('./types/stringSet/test')
require('./commonjs/build/test')

/** @type {() => never} */
const assert = () => { throw 'assert' }

/** @type {(_: boolean) => void} */
const assert_if = c => { if (c) { throw 'assert_if' } }

{
    i.parseModuleUrl('')(
        assert,
        e => assert_if(e.id !== 'expected' || e.params[0] !== ':'))
}

{
    i.parseModuleUrl(':')(
        assert,
        e => assert_if(e.id !== 'unknownProtocol'))
}

{
    i.parseModuleUrl('github:r')(
        assert,
        e => assert_if(e.id !== 'expected'))
}

{
    i.parseModuleUrl('github:functionalscript/node-example')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            'branch' in v),
        assert)
}

{
    i.parseModuleUrl('github:functionalscript/node-example#main')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            !('branch' in v) ||
            v.branch !== 'main'),
        assert)
}

{
    i.parseModuleUrl('github:functionalscript/node-example#4b14a7a2b11cf53f037931eb7bef240f96dcea64')(
        v => assert_if(
            v.repo.org !== 'functionalscript' ||
            v.repo.name !== 'node-example' ||
            !('commit' in v) ||
            v.commit !== '4b14a7a2b11cf53f037931eb7bef240f96dcea64'),
        assert)
}

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