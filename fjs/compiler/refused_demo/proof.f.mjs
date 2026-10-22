/**
 * Proofs for a refused construct's page, against an in-memory page whose
 * files are texts by path.
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { FetchText } from '../../effects/browser/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { RefusedSample, State } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { excerpt, init, refusedDemo, report, reportText } from './module.f.mjs'

/** A sample JavaScript answers `true` for. @type {RefusedSample} */
const sample = { directory: 'spec/in', entry: true }

/** @type {(files: StringMap<string>) => MemOperationMap<FetchText, null>} */
const page = files => ({
    fetchText: path => s => {
        const text = files[path]
        return [s, text === undefined ? error(ioError({ message: `${path}: HTTP 404` })) : ok(text)]
    },
})

/** @type {<T>(files: StringMap<string>) => (effect: Effect<FetchText, T, never>) => T} */
const perform = files => effect => {
    const [, result] = run(page(files))(null)(effect)
    assert(result[0] === 'ok')
    return result[1]
}

const refused = 'const o = {};\nexport default "a" in o;\n'

const demo = refusedDemo(sample)

/** @type {(state: State) => string} */
const shown = state => htmlToString(demo.view(state))

export const proof = {
    excerpt: () => {
        assertEq(excerpt('a\nbcd', 2, 2, 2), '2 | bcd\n  |  ^^')
        assertEq(excerpt('a', 3, 1, 1), '3 | \n  | ^')
    },
    report: () => {
        const r = report(refused)
        assert(r[0] === 'error')
        assertEq(reportText(refused)(r[1]), 'sample.mjs:2:20 - error: unexpected token\n2 | export default "a" in o;\n  |                    ^')
        assertEq(report('export default 1;')[0], 'ok')
    },
    reportText: () => {
        // A refusal at no token is the line alone.
        assertEq(reportText('')(['m', 'output.js - error: m', null]), 'output.js - error: m')
        assertEq(reportText('')(['m', 'd', { message: 'm', metadata: null }]), 'd')
        // A token's span marks each of its characters, on its line only.
        const at = { path: 'sample.mjs', line: 1, column: 2 }
        assertEq(reportText('abcd')(['m', 'd', { message: 'm', metadata: at, end: { line: 1, column: 4 } }]), 'd\n1 | abcd\n  |  ^^')
        assertEq(reportText('abcd')(['m', 'd', { message: 'm', metadata: at, end: { line: 2, column: 4 } }]), 'd\n1 | abcd\n  |  ^')
        assertEq(reportText('abcd')(['m', 'd', { message: 'm', metadata: at, end: { line: 1, column: 2 } }]), 'd\n1 | abcd\n  |  ^')
    },
    update: () => {
        const files = { '/spec/in/sample.mjs': refused }
        assertStructurallySame(perform(files)(demo.update(init)({ kind: 'start' })), ok(refused))
        assertStructurallySame(perform({})(demo.update(init)({ kind: 'start' })), error('/spec/in/sample.mjs: HTTP 404'))
        assertStructurallySame(perform(files)(demo.update(ok(refused))({ kind: 'click', name: 'run' })), ok(refused))
    },
    view: () => {
        const loading = shown(init)
        assert(loading.includes('Loading…'), loading)
        assert(loading.includes('<pre>true</pre>'), loading)
        const page = shown(ok(refused))
        assert(page.includes('<div data-refused=""><strong>Not allowed in FunctionalScript</strong>'), page)
        assert(page.includes('sample.mjs:2:20 - error: unexpected token'), page)
        const accepted = shown(ok('export default 1;'))
        assert(accepted.includes('This page is out of date:'), accepted)
        assert(!accepted.includes('data-refused'), accepted)
    },
}
