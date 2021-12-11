const { tryCatch } = require('../result')
const { unwrap } = require('../../types/result')
const moduleFunction = require('../../commonjs/module/function')

/** @type {(f: Function) => moduleFunction.Function} */
const build = f => immutableRequire => mutableData => {
    /** @type {(path: string) => unknown} */
    const mutableRequire = path => {
        const [result, data] = immutableRequire(path)(mutableData)
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
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))

module.exports = {
    /** @readonly */
    compile,
}
