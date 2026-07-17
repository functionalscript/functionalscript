import { main } from './module.f.ts'
import { emptyState, virtual } from '../effects/node/virtual/module.f.ts'
import { assertEq, assertNotNullish } from '../asserts/module.f.ts'

export const proof = {
    main: () => {
        assertNotNullish(main(), 'expected a program effect')
    },
    run: () => {
        const state = { ...emptyState, root: { '.github': { workflows: {} } } }
        const [_, result] = virtual(state)(main())
        assertEq(result, 0)
    },
}
