import unsafeResult from '../types/result/module.mjs'
const { tryCatch } = unsafeResult
import * as result from '../types/result/module.f.mjs'
const { unwrap } = result
import * as ModuleFunction from './module/function/module.f.mjs'

/** @type {(f: Function) => ModuleFunction.Function_} */
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

/** @type {ModuleFunction.Compile} */
export const compile = source =>
    // Side effect: a `Function` constructor is not allowed in FunctionalScript.
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))
