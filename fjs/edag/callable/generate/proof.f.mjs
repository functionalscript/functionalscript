import { assert, assertEq } from '../../../asserts/module.f.mjs'
import { exitCode, readUtf8File } from '../../../effects/node/module.f.mjs'
import { emptyState, virtual } from '../../../effects/node/virtual/module.f.mjs'
import { generate, main } from './module.f.mjs'

export const proof = {
    source: () => {
        assert(generate(3).endsWith([
            '    g => (...rest) => g([], rest),',
            '    g => (a0, ...rest) => g([a0], rest),',
            '    g => (a0, a1, ...rest) => g([a0, a1], rest),',
            '    g => (a0, a1, a2, ...rest) => g([a0, a1, a2], rest),',
            '];', '',
        ].join('\n')))
        assertEq(generate(0).split('g =>').length - 1, 1)
    },
    main: () => {
        const root = { fjs: { edag: { callable: {} } } }
        const [state, result] = virtual({ ...emptyState, root })(main())
        assertEq(exitCode(result), 0)
        const [, [tag, source]] = virtual(state)(readUtf8File('fjs/edag/callable/table.f.mjs'))
        assert(tag === 'ok', source)
        assertEq(source, generate(32))
    },
}
