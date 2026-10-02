/**
 * @import { Dir } from '../effects/node/virtual/types.ts'
 */

import { assert, assertEq, todo } from '../asserts/module.f.mjs'
import { unwrap } from '../types/result/module.f.mjs'
import { emptyState, virtual } from '../effects/node/virtual/module.f.mjs'
import { allFiles, isThirdParty, shouldLoad } from './module.f.mjs'

export const proof = {
    isThirdParty: () => {
        // Tooling, dependencies and Rust build output.
        assert(isThirdParty('.git'))
        assert(isThirdParty('.github'))
        assert(isThirdParty('node_modules'))
        assert(isThirdParty('target'))
        // This repository's own directories, including ones that merely
        // contain a third-party name.
        assert(!isThirdParty('fjs'))
        assert(!isThirdParty('nanvm-lib'))
        assert(!isThirdParty('targets'))
        assert(!isThirdParty('my.target'))
    },
    allFilesSkipsThirdPartyTrees: () => {
        // Test discovery and `fjs compile` walk the same tree `clean` and the
        // website do: a Rust build tree is not entered, though it holds a file
        // that would otherwise match. A dot-file at any depth is skipped too.
        /** @type {Dir} */
        const root = {
            'target': { 'debug': { 'build.f.mjs': [] } },
            '.cache': { 'c.f.mjs': [] },
            'sub': { 'a.f.mjs': [], '.b.f.mjs': [] },
        }
        const [, result] = virtual({ ...emptyState, root })(allFiles('.', shouldLoad))
        assertEq(unwrap(result).join(','), './sub/a.f.mjs')
    },
    shouldLoad: () => {
        // Every FunctionalScript extension is loaded whatever the file name.
        assert(shouldLoad('foo.f.ts'))
        assert(shouldLoad('foo.f.mts'))
        assert(shouldLoad('bar.f.js'))
        assert(shouldLoad('module.f.mjs'))
        assert(shouldLoad('proof.f.mts'))
        assert(shouldLoad('proof.f.mjs'))
        // Every impure JS/TS extension is loaded only under the `proof` name.
        assert(shouldLoad('proof.ts'))
        assert(shouldLoad('proof.mts'))
        assert(shouldLoad('proof.js'))
        assert(shouldLoad('proof.mjs'))
        assert(!shouldLoad('module.ts'))
        assert(!shouldLoad('module.mts'))
        assert(!shouldLoad('module.js'))
        assert(!shouldLoad('module.mjs'))
        assert(!shouldLoad('readme.md'))
    },
    shouldPass: () => ({
        then: () => undefined
    }),
    ctor: () => {
        const c = (() => { })['constructor']
        const f = c('return 5')
        const result = f()
        assertEq(result, 5, 'function')
    },
    ctorEmpty: () => {
        /** @type {any} */
        const o = {}
        const c = o['constructor']
        // console.log(c)
        // console.log(c(()=>{}))
    },
    ctorUndefined: () => {
        /** @type {any} */
        const o = {
            constructor: undefined
        }
        const c = o['constructor']
        //console.log(c)
    },
    number: () => {
        /** @type {any} */
        const b = '42'
        const r = Number(b)
        //console.log(r)
    },
    properties: () => {
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
    },
    getOwnPropertyDescriptor: () => {
        const x = { 'a': 12 }
        const c = Object.getOwnPropertyDescriptor(x, 'constructor')
        const a = Object.getOwnPropertyDescriptor(x, 'a')
    },
    throw: () => {
        todo()
    },
}
