/**
 * Proofs of [the builders of spread parts](./module.f.js): the calls each
 * builder makes, in their order, for an item that stands alone and for a
 * spread.
 *
 * @import { Term } from '../../types.ts'
 */

import { assertStructurallySame } from '../../../asserts/module.f.js'
import { array, builder, object, string } from '../../l0/module.f.js'
import { add, call, cast, exact, f64, f64c, float, get, if_, let_, lit, loop, lt, next, u } from '../../module.f.js'
import { arrayBuilt, objectBuilt } from './module.f.js'

/** The length of a spread, as a float. @type {(x: Term) => Term} */
const length = x => float(call('Containers', 'length', [x]))

/** The count of an item `a` that stands alone and a spread `s`, and the builder that it begins. @type {(begin: string, k: (b: Term) => Term) => Term} */
const counted = (begin, k) => exact(u(31), add(lit(f64c, 1), length(get('s'))), 'S.n', n => k(call('Containers', begin, [n])))

export const proof = {
    // An item by `push`, a spread by one `push_all`, sealed as an array.
    array: () => assertStructurallySame(arrayBuilt('S', [[false, get('a')], [true, get('s')]]), counted('begin_array', b =>
        let_('S.b0', call('Containers', 'push', [b, get('a')]),
            let_('S.b1', call('Containers', 'push_all', [get('S.b0'), get('s')]),
                cast(array, call('Containers', 'seal', [get('S.b1')]), 'array', x => x))))),
    // A named value as its property, a spread object key by key, sealed as an object.
    object: () => assertStructurallySame(objectBuilt('S', [[false, get('a')], [true, get('s')]], ['x', '']), counted('begin_object', b =>
        let_('S.b0', call('Containers', 'push_property', [b, lit(string, 'x'), get('a')]),
            let_('S.b1', loop(
                'S.1',
                [['S.1.b', builder, get('S.b0')], ['S.1.i', f64, lit(f64c, 0)]],
                if_(
                    lt(get('S.1.i'), length(get('s'))),
                    exact(u(31), get('S.1.i'), 'S.1.k', k => let_('S.1.pushed',
                        call('Containers', 'push_property', [get('S.1.b'), call('Containers', 'key', [get('s'), k]), call('Containers', 'item', [get('s'), k])]),
                        next('S.1', [['S.1.b', get('S.1.pushed')], ['S.1.i', add(get('S.1.i'), lit(f64c, 1))]]))),
                    get('S.1.b'),
                ),
            ), cast(object, call('Containers', 'seal', [get('S.b1')]), 'object', x => x))))),
}
