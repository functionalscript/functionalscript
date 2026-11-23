/**
 * Proofs of [the inlined loops of `every` and `filter`](./module.f.js):
 * each loop over a test of the item and its index, through the lifetime
 * pass and the checker, as text.
 *
 * @import { Module, Term } from '../../types.ts'
 */

import { assertEq, assertOk } from '../../../asserts/module.f.js'
import { check } from '../../check/module.f.js'
import { any, l0 } from '../../l0/module.f.js'
import { bool, fn, get, lit, lt, f64c, only } from '../../module.f.js'
import { print } from '../../print/module.f.js'
import { lifetime } from '../../lifetime/module.f.js'
import { everyLoop, filterLoops, locals, names } from './module.f.js'

/** The function `f` of an array `a`, answering `body`, as text once the lifetime pass and the checker take it. @type {(result: import('../../types.ts').Type, body: Term) => string} */
const owned = (result, body) => {
    /** @type {Module} */
    const m = { imports: l0, functions: [['f', fn([['a', only(any, 'array')]], result, body)]], exports: ['f'] }
    const r = assertOk(lifetime(m))
    assertOk(check(r))
    return print({ imports: [], functions: r.functions, exports: [] })
}

export const proof = /** @type {const} */ ({
    names: () => {
        assertEq(names('E').i, 'E.i')
        assertEq(locals('E', false).map(([k]) => k).join(' '), 'E.i E.item')
        assertEq(locals('F', true).map(([k]) => k).join(' '), 'F.b F.count F.i F.item')
    },
    // `every` stops at the first item whose test fails.
    every: () => assertEq(owned(bool, everyLoop('E', get('a'), lt(get(names('E').i), lit(f64c, 3)))), [
        'fn f(a: any.only(array)) -> bool =',
        '    let E.n = Containers.length(a)',
        '    loop E (E.i: f64 = 0.0)',
        '        if lt(E.i, float(E.n))',
        '        then',
        '            let E.k = trunc_sat(u(31), E.i)',
        '            if eq(float(E.k), E.i)',
        '            then',
        '                let E.item = Containers.item(a, E.k)',
        '                let $2 =',
        '                    if lt(E.i, 3.0)',
        '                    then',
        '                        let $0 = add(E.i, 1.0)',
        '                        let $1 = Any.drop(E.item)',
        '                        br E { E.i: $0 }',
        '                    else',
        '                        false',
        '                let $3 = Any.drop(E.item)',
        '                $2',
        '            else',
        "                trap('inexact')",
        '        else',
        '            true',
        '',
    ].join('\n')),
    // `filter` marks each item, then pushes the kept ones.
    filter: () => assertEq(owned(any, filterLoops('F', get('a'), lt(get(names('F').i), lit(f64c, 3)))), [
        'fn f(a: any.only(array)) -> any =',
        '    let F.n = Containers.length(a)',
        '    loop F (F.b: builder = Containers.begin_array(F.n), F.i: f64 = 0.0, F.count: f64 = 0.0)',
        '        if lt(F.i, float(F.n))',
        '        then',
        '            let F.k = trunc_sat(u(31), F.i)',
        '            if eq(float(F.k), F.i)',
        '            then',
        '                let F.item = Containers.item(a, F.k)',
        '                let F.keep = lt(F.i, 3.0)',
        '                if F.keep',
        '                then',
        '                    let F.pushed = Containers.push(F.b, Any.null)',
        '                    let $3 = add(F.i, 1.0)',
        '                    let $4 = add(F.count, 1.0)',
        '                    let $5 = Any.drop(F.item)',
        '                    br F { F.b: F.pushed, F.i: $3, F.count: $4 }',
        '                else',
        '                    let F.pushed = Containers.push(F.b, Any.undefined)',
        '                    let $6 = add(F.i, 1.0)',
        '                    let $7 = Any.drop(F.item)',
        '                    br F { F.b: F.pushed, F.i: $6, F.count: F.count }',
        '            else',
        "                trap('inexact')",
        '        else',
        '            let $2 = Containers.seal(F.b)',
        '            let $14 =',
        '                match $2',
        '                  array as F.mask =>',
        '                    let F.c = trunc_sat(u(31), F.count)',
        '                    if eq(float(F.c), F.count)',
        '                    then',
        '                        loop F.kept (F.kb: builder = Containers.begin_array(F.c), F.j: f64 = 0.0)',
        '                            if lt(F.j, float(F.n))',
        '                            then',
        '                                let F.jk = trunc_sat(u(31), F.j)',
        '                                if eq(float(F.jk), F.j)',
        '                                then',
        '                                    let $0 = Containers.item(F.mask, F.jk)',
        '                                    match $0',
        '                                      null =>',
        '                                        let F.kp = Containers.push(F.kb, Containers.item(a, F.jk))',
        '                                        let $8 = add(F.j, 1.0)',
        '                                        let $9 = Any.drop($0)',
        '                                        br F.kept { F.kb: F.kp, F.j: $8 }',
        '                                      else =>',
        '                                        let $10 = add(F.j, 1.0)',
        '                                        let $11 = Any.drop($0)',
        '                                        br F.kept { F.kb: F.kb, F.j: $10 }',
        '                                else',
        "                                    trap('inexact')",
        '                            else',
        '                                let $1 = Containers.seal(F.kb)',
        '                                let $12 =',
        '                                    match $1',
        '                                      array as F.kept.array =>',
        '                                        Any.dup(F.kept.array)',
        '                                      else =>',
        "                                        trap('not array')",
        '                                let $13 = Any.drop($1)',
        '                                $12',
        '                    else',
        "                        trap('inexact')",
        '                  else =>',
        "                    trap('not array')",
        '            let $15 = Any.drop($2)',
        '            $14',
        '',
    ].join('\n')),
})
