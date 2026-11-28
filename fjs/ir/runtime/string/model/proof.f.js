/**
 * Proofs of the model of String's IR module where the IR heap holds long
 * strings: what the IR makes is short at 2 units at most, `concat` answers
 * an operand where the other is empty and leaves a host's operand's result
 * to the host, and `substring` fails outside its string, answers the
 * string itself for every unit, and leaves a host's string to the host.
 *
 * @import { Form, Str } from './types.ts'
 */

import { assertEq } from '../../../../asserts/module.f.js'
import { concat, made, substring, unit } from './module.f.js'

/** A string of `form` and the units of `text`. @type {(form: Form, text: string) => Str} */
const str = (form, text) => ({ form, units: [...text].map(c => c.charCodeAt(0)) })

/** A string as its form and its text, or `null`. @type {(s: Str | null) => string} */
const shown = s => s === null ? 'null' : `${s.form} ${String.fromCharCode(...s.units)}`

/** The host's emit policies: A boxes no string short, B up to 2 units. */
const [a, b] = [-1, 2]

export const proof = {
    // What the IR makes is a short box at 2 units at most, as NaNVM's policy B boxes them, and a block otherwise.
    made: () => {
        assertEq(['', 'x', 'xy', 'xyz'].map(t => shown(made(str('ir', t).units))).join(), 'short ,short x,short xy,ir xyz')
    },
    // An empty operand answers the other as it is, and two strings of the IR join in the IR.
    concat: () => {
        const [empty, x, xy, long] = [str('short', ''), str('short', 'x'), str('short', 'xy'), str('ir', 'long')]
        assertEq(concat(a)(empty, long), long)
        assertEq(concat(a)(long, empty), long)
        assertEq(concat(a)(empty, empty), empty)
        assertEq(shown(concat(a)(x, x)), 'short xx')
        assertEq(shown(concat(a)(x, xy)), 'ir xxy')
        assertEq(shown(concat(a)(long, x)), 'ir longx')
    },
    // A host's operand leaves the result to the host, which boxes it short as its policy says.
    concatHosted: () => {
        const [host, x, empty] = [str('host', 'h'), str('short', 'x'), str('short', '')]
        assertEq(shown(concat(a)(host, x)), 'host hx')
        assertEq(shown(concat(b)(host, x)), 'short hx')
        assertEq(shown(concat(b)(x, str('host', 'hello'))), 'host xhello')
        assertEq(shown(concat(a)(empty, host)), 'host h')
    },
    // A substring outside its string fails; every unit is the string itself, and any other part what the IR makes.
    substring: () => {
        const s = str('ir', 'hello')
        assertEq([[0, 6], [3, 2], [-1, 2], [6, 6]].map(([i, j]) => shown(substring(a)(s, i, j))).join(), 'null,null,null,null')
        assertEq(substring(a)(s, 0, 5), s)
        assertEq([[2, 2], [1, 2], [1, 3], [1, 4]].map(([i, j]) => shown(substring(a)(s, i, j))).join(), 'short ,short e,short el,ir ell')
        const t = str('short', 'ab')
        assertEq(substring(a)(t, 0, 2), t)
        assertEq(shown(substring(a)(t, 1, 2)), 'short b')
    },
    // A host's string leaves its parts to the host, every unit too.
    substringHosted: () => {
        const h = str('host', 'hello')
        assertEq([[0, 5], [1, 3], [5, 5]].map(([i, j]) => shown(substring(a)(h, i, j))).join(), 'host hello,host el,host ')
        assertEq([[0, 5], [1, 3], [5, 5]].map(([i, j]) => shown(substring(b)(h, i, j))).join(), 'host hello,short el,short ')
        assertEq(shown(substring(b)(h, 4, 6)), 'null')
    },
    // A unit past either end fails.
    unit: () => {
        const s = str('short', 'ab')
        assertEq([-1, 0, 1, 2].map(i => `${unit(s, i)}`).join(), 'null,97,98,null')
    },
}
