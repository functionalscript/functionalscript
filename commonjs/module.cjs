const { tryCatch } = require('../types/result/module.cjs')
const { unwrap } = require('../types/result/module.f.cjs')
const moduleFunction = require('./module/function/module.f.cjs')

/** @type {(f: Function) => moduleFunction.Function_} */
const build = f => immutableRequire => mutableData => {
    /** @type {(path: string) => unknown} */
    const mutableRequire = path => {
        const [result, data] = immutableRequire(path)(mutableData)
        // Side effect: setting a variable from a nested function (closure)
        // is not allowed in FunctionalScript.
        mutableData = data
        return unwrap(result)
    }
    const result = tryCatch(() => {
        const mutableModule = { exports: {} }
        f(mutableModule, mutableRequire)
        return mutableModule.exports
    })
    return [result, mutableData]
}

/** @type {moduleFunction.Compile} */
const compile = source =>
    // Side effect: a `Function` constructor is not allowed in FunctionalScript.
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))

module.exports = {
    /** @readonly */
    compile,
}
