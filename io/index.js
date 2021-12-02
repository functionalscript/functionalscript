const result = require('../result')
const run = require('../commonjs/run')

/** @type {(f: Function) => run.Module} */
const runModule = f => req => info => {
    /** @type {(path: string) => unknown} */
    const mutRequire = path => {
        const [result, newInfo] = req(info)(path)
        info = newInfo
        if (result[0] === 'error') { throw result[1] }
        return result[1]
    }
    const mutModule = { exports: {} }
    try {
        f(mutModule, mutRequire)
    } catch (error) {
        return [result.error(error), info]
    }
    return [result.ok(mutModule.exports), info]
}

/** @type {run.Compile} */
const compile = source => {
    try {
        return result.ok(runModule(new Function('module', 'require', `"use strict";${source}`)))
    } catch (error) {
        return result.error(error)
    }
}

module.exports = {
    compile,
}