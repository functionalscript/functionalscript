const { tryCatch } = require('../result')
const { unwrap } = require('../../types/result')
const run = require('../../commonjs/run')

/** @type {(f: Function) => run.Module} */
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

/** @type {run.Compile} */
const compile = source => 
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))

module.exports = {
    /** @readonly */
    compile,
}
