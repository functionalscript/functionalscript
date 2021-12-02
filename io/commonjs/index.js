const { ok, error } = require('../../types/result')
const run = require('../../commonjs/run')

/** @type {(f: Function) => run.Module} */
const runModule = f => req => info => {
    /** @type {(path: string) => unknown} */
    const mutableRequire = path => {
        const [result, newInfo] = req(info)(path)
        info = newInfo
        if (result[0] === 'error') { throw result[1] }
        return result[1]
    }
    const mutableModule = { exports: {} }
    try {
        f(mutableModule, mutableRequire)
    } catch (e) {
        return [error(e), info]
    }
    return [ok(mutableModule.exports), info]
}

/** @type {run.Compile} */
const compile = source => {
    try {
        return ok(runModule(Function('module', 'require', `"use strict";${source}`)))
    } catch (e) {
        return error(e)
    }
}

module.exports = {
    /** @readonly */
    compile,
}