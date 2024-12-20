import unsafeResult from '../types/result/module.ts'
const { tryCatch } = unsafeResult
import * as result from '../types/result/module.f.mjs'
const { unwrap } = result
import * as ModuleFunction from './module/function/module.f.mjs'

const build
    : (f: Function) => ModuleFunction.Function_
    = f => immutableRequire => mutableData => {
    const mutableRequire
        : (path: string) => unknown
        = path => {
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

export const compile
    : ModuleFunction.Compile
    = source =>
    // Side effect: a `Function` constructor is not allowed in FunctionalScript.
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))
