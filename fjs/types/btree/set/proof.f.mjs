/**
 * @import { TNode } from '../types/types.ts'
 */

import { set as setSet } from './module.f.mjs'
import { cmp } from '../../string/module.f.mjs'
import { assertEq } from '../../../asserts/module.f.mjs'
import { expectedSquares, jsonStr, set, squares } from '../testlib.f.mjs'

/** @type {(node: TNode<string>) => (value: string) => (g: (v: string | null) => string) => TNode<string>} */
const replace = node => value => g =>
    setSet(cmp(value))(g)(node)

export const proof = {
    // One entry per `n`, each building its tree from scratch, so a reshaping
    // bug is reported at the first `n` it breaks rather than at every later
    // one.
    growth: expectedSquares.map(([n, expected]) => () => assertEq(jsonStr(squares(n)), expected)),
    replace: [
        // Replacing a key already stored as a branch separator (rather than in
        // a leaf) exercises the `x.length === 3` and `x.length === 5` arms of
        // the "replace" case, which plain sequential inserts never reach.
        () => {
            const _map = squares(10)
            // top level is a Branch3 with "4" as its separator (x.length === 3)
            assertEq(jsonStr(_map), '[[["1","100"],"16",["25","36"]],"4",[["49"],"64",["81","9"]]]')
            const replaced = replace(_map)('4')(() => '4-updated')
            assertEq(jsonStr(replaced), '[[["1","100"],"16",["25","36"]],"4-updated",[["49"],"64",["81","9"]]]')
        },

        () => {
            const _map = squares(13)
            // top level is a Branch5 with "16" as its first separator (i === 1)
            // and "4" as its second separator (i === 3), so both x.length === 5
            // replace arms are reachable from this one fixture.
            assertEq(
                jsonStr(_map),
                '[[["1"],"100",["121","144"]],"16",[["169"],"25",["36"]],"4",[["49"],"64",["81","9"]]]',
            )
            const replacedFirst = replace(_map)('16')(() => '16-updated')
            assertEq(
                jsonStr(replacedFirst),
                '[[["1"],"100",["121","144"]],"16-updated",[["169"],"25",["36"]],"4",[["49"],"64",["81","9"]]]',
            )
            const replacedSecond = replace(_map)('4')(() => '4-updated')
            assertEq(
                jsonStr(replacedSecond),
                '[[["1"],"100",["121","144"]],"16",[["169"],"25",["36"]],"4-updated",[["49"],"64",["81","9"]]]',
            )
        },

        // Replacing the first value of a two-value leaf exercises the
        // `x.length === 2` arm of the `i === 1` "replace" case, which the
        // fixtures above never reach — their two-value-leaf replaces all land
        // on the second value.
        () => {
            /** @type {TNode<string>} */
            const _map = set(['1'])('2')
            assertEq(jsonStr(_map), '["1","2"]')
            const replaced = replace(_map)('1')(() => '1-updated')
            assertEq(jsonStr(replaced), '["1-updated","2"]')
        },
    ],
}
