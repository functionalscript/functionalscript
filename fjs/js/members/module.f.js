/**
 * The member functions of the built-in types, one table: a type, then a
 * name the type's prototype has and [`../prototype`](../prototype/module.f.js)
 * admits as a call, then the function of the receiver and the arguments
 * as the call passed them — `(self, ...args)`, the receiver typed as the
 * type it is under. The table is the inventory of what a FunctionalScript
 * program may call on a value, complete by construction: `types.ts`
 * types every type's keys as exactly the admitted names of its prototype,
 * and every entry as callable with the receiver and the arguments.
 *
 * An entry is a body, or `todo` where none is written yet. The typed
 * `map` and both `concat` bodies are also used by the `member` section of
 * [`../runtime`](../runtime/module.f.js), beside its `startsWith` and
 * `codePointAt` bodies. The remaining names are answered natively today,
 * NaNVM in `vm/lambda` and the interpreter in `fjs/edag/value/method`.
 * Which names stay native, and how the
 * executors are generated from this table, is decided after it is filled
 * ([`../todo/runtime-members.md`](../todo/runtime-members.md)).
 *
 * @module
 *
 * @import { Members } from './types.ts'
 */

import { todo } from '../../asserts/module.f.js'
import { map } from './array/map/module.f.js'
import { concat as arrayConcat } from './array/concat/module.f.js'
import { concat as stringConcat } from './string/concat/module.f.js'

/** @type {Members} */
export const members = {
    boolean: {
        toString: todo,
    },
    string: {
        at: todo,
        charAt: todo,
        charCodeAt: todo,
        codePointAt: todo,
        concat: stringConcat,
        endsWith: todo,
        includes: todo,
        indexOf: todo,
        isWellFormed: todo,
        lastIndexOf: todo,
        padEnd: todo,
        padStart: todo,
        repeat: todo,
        replace: todo,
        replaceAll: todo,
        slice: todo,
        split: todo,
        startsWith: todo,
        substring: todo,
        toLowerCase: todo,
        toString: todo,
        toUpperCase: todo,
        toWellFormed: todo,
        trim: todo,
        trimEnd: todo,
        trimStart: todo,
    },
    number: {
        toExponential: todo,
        toFixed: todo,
        toPrecision: todo,
        toString: todo,
    },
    bigint: {
        toString: todo,
    },
    object: {
        toString: todo,
    },
    array: {
        at: todo,
        concat: arrayConcat,
        every: todo,
        filter: todo,
        find: todo,
        findIndex: todo,
        findLast: todo,
        findLastIndex: todo,
        flat: todo,
        flatMap: todo,
        includes: todo,
        indexOf: todo,
        join: todo,
        lastIndexOf: todo,
        map,
        reduce: todo,
        reduceRight: todo,
        slice: todo,
        some: todo,
        toReversed: todo,
        toSorted: todo,
        toSpliced: todo,
        toString: todo,
        with: todo,
    },
    function: {
        toString: todo,
    },
}
