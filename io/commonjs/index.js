const { tryCatch } = require('../result')
const { unwrap } = require('../../types/result')
const run = require('../../commonjs/run')

/** @type {(f: Function) => run.Module} */
const createModule = f => req => mutableInfo => {
    /** @type {(path: string) => unknown} */
    const mutableRequire = path => {
        const [result, info] = req(mutableInfo)(path)
        mutableInfo = info
        return unwrap(result)
    }
    const result = tryCatch(() => {
        const mutableModule = { exports: {} }
        f(mutableModule, mutableRequire)
        return mutableModule.exports
    })
    return [result, mutableInfo]
}

/** @type {run.Compile} */
const compile = source => 
    tryCatch(() => createModule(Function('module', 'require', `"use strict";${source}`)))

module.exports = {
    /** @readonly */
    compile,
}
