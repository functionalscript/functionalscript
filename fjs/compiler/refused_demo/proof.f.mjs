/**
 * Proofs for a refused construct's page, against an in-memory page whose
 * files are texts by path.
 *
 * @import { Effect } from '../../effects/types.ts'
 * @import { FetchText } from '../../effects/browser/types.ts'
 * @import { MemOperationMap } from '../../effects/mock/types.ts'
 * @import { StringMap } from '../../types/object/types.ts'
 * @import { RefusedSample, State, Suggestion } from './types.ts'
 */

import { assert, assertEq, assertStructurallySame } from '../../asserts/module.f.js'
import { ioError } from '../../effects/module.f.mjs'
import { run } from '../../effects/mock/module.f.mjs'
import { htmlToString } from '../../media/html/module.f.mjs'
import { error, ok } from '../../types/result/module.f.js'
import { compileAs, excerpt, init, refusedDemo, report, reportText, suggestedText } from './module.f.mjs'

/** @type {Suggestion} */
const suggestion = { message: 'no in', width: 2, label: 'here', help: 'use h:', fix: 'h(o, "a")', note: 'see in' }

/** A sample JavaScript answers `true` for, and its alternative `false`. @type {RefusedSample} */
const sample = { directory: 'spec/in', answer: 'true', alternative: false, suggestion }

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

const refused = 'const o = {};\nexport default o in o;\n'

const accepted = 'export default false;\n'

/** @type {(source: string, alternative: string) => State} */
const loaded = (source, alternative) => ({ source: ok(source), alternative: ok(alternative) })

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
        assertEq(reportText(refused)(r[1]), 'sample.mjs:2:18 - error: the left operand of in must be a string literal\n2 | export default o in o;\n  |                  ^')
        assertEq(report('export default 1;')[0], 'ok')
        assertEq(compileAs('alternative.f.js')(accepted)[0], 'ok')
    },
    suggestedText: () => {
        const r = report(refused)
        assert(r[0] === 'error')
        assertEq(suggestedText(suggestion)(refused)(r[1]), [
            'sample.mjs:2:18 - error: no in',
            '2 | export default o in o;',
            '  |                  ^^ here',
            '  = help: use h:',
            '          h(o, "a")',
            '  = note: see in',
        ].join('\n'))
        // A refusal at no token is proposed at none.
        assertEq(suggestedText(suggestion)('')(['m', 'd', null]), 'sample.mjs - error: no in\n = help: use h:\n         h(o, "a")\n = note: see in')
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
        const files = { '/spec/in/sample.mjs': refused, '/spec/in/alternative.f.js': accepted }
        assertStructurallySame(perform(files)(demo.update(init)({ kind: 'start' })), loaded(refused, accepted))
        assertStructurallySame(perform({})(demo.update(init)({ kind: 'start' })), {
            source: error('/spec/in/sample.mjs: HTTP 404'),
            alternative: error('/spec/in/alternative.f.js: HTTP 404'),
        })
        assertStructurallySame(perform(files)(demo.update(loaded(refused, accepted))({ kind: 'click', name: 'run' })), loaded(refused, accepted))
    },
    view: () => {
        const loading = shown(init)
        assert(loading.includes('Loading…'), loading)
        assert(loading.includes('<pre>true</pre>'), loading)
        const page = shown(loaded(refused, accepted))
        assert(page.includes('<div data-refused=""><strong>Not allowed in FunctionalScript</strong>'), page)
        assert(page.includes('sample.mjs:2:18 - error: the left operand of in must be a string literal'), page)
        assert(page.includes('sample.mjs:2:18 - error: no in'), page)
        assert(page.includes('What fjs compile alternative.f.js output.js writes:'), page)
        assert(page.includes('<pre>false</pre>'), page)
        // An alternative the compiler refuses shows the line it prints, not a plausible output.
        const wrong = shown(loaded(refused, refused))
        assert(wrong.includes('alternative.f.js:2:18 - error: the left operand of in must be a string literal'), wrong)
        const outdated = shown(loaded('export default 1;', accepted))
        assert(outdated.includes('This page is out of date:'), outdated)
        assert(!outdated.includes('data-refused'), outdated)
    },
}
