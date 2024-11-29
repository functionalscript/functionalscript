import { tryCatch } from '../types/result/module.cjs'
import { unwrap } from '../types/result/module.f.cjs'
import moduleFunction, * as moduleFunctionT from './module/function/module.f.mjs'

/** @type {(f: Function) => moduleFunctionT.Function_} */
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

/** @type {moduleFunctionT.Compile} */
const compile = source =>
    // Side effect: a `Function` constructor is not allowed in FunctionalScript.
    tryCatch(() => build(Function('module', 'require', `"use strict";${source}`)))

export default {
    /** @readonly */
    compile,
}
