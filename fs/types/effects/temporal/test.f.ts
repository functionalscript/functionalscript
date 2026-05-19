import { assert } from '../../../dev/module.f.ts'
import { emptyState, virtual } from '../node/virtual/module.f.ts'
import { now } from './module.f.ts'

export default {
    now: () => {
        const epochNs = 1_000_000_000n
        const [state, result] = virtual({ ...emptyState, epochNs })(now())
        assert(result === epochNs, result)
        assert(state.epochNs === epochNs, state.epochNs)
    },
}
