/**
 * The member functions of the built-in types, one table: a type, then a
 * name the type's prototype has and [`../prototype`](../prototype/module.f.js)
 * admits as a call, then the function of the receiver and the arguments
 * as the call passed them — `(self, ...args)`, the receiver typed as the
 * type it is under. The table is the inventory of what a FunctionalScript
 * program may call on a value, complete by construction: `types.ts` pins
 * every type's keys to exactly the admitted names of its prototype.
 *
 * An entry is a body, or `todo` where none is written yet: the executors
 * answer those natively today, NaNVM in `vm/lambda` and the interpreter in
 * `fjs/edag/value/method`, and the one body written so far,
 * `startsWith`, is the `member` section of [`../runtime`](../runtime/module.f.js),
 * which the static runtime compiles. Which names stay native, and how the
 * executors are generated from this table, is decided after it is filled
 * ([`../todo/runtime-members.md`](../todo/runtime-members.md)).
 *
 * @module
 *
 * @import { Members } from './types.ts'
 */

import { todo } from '../../asserts/module.f.mjs'

/** @satisfies {Members} */
export const members = {
    boolean: {
        toString: todo,
    },
    string: {
        at: todo,
        charAt: todo,
        charCodeAt: todo,
        codePointAt: todo,
        concat: todo,
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
        concat: todo,
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
        map: todo,
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
