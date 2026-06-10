import { main } from './module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { assert } from '../asserts/module.f.ts'

export const proof = {
    main: () => {
        const program = main()
        if (program === undefined) { throw 'expected a program effect' }
    },
    run: () => {
        const state = { ...emptyState, root: { '.github': { workflows: {} } } }
        const [_, result] = virtual(state)(main())
        assert(result === 0, result)
    },
}
