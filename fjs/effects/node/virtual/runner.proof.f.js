/**
 * @import { State, _QueuedRequest } from './types.ts'
 * @import { NodeOp, Now, RequestListener } from '../types.ts'
 * @import { PartialMemOperationMap } from '../../mock/types.ts'
 */

import { assertEq, assertOk } from '../../../asserts/module.f.js'
import { both, createServer, listen, nodeCommands, now } from '../module.f.js'
import { pureOk, resultMapStep, step } from '../../module.f.js'
import { empty, nonEmpty } from '../../list/module.f.js'
import { partialRun } from '../../mock/module.f.js'
import { ok } from '../../../types/result/module.f.js'
import { utf8 } from '../../../text/module.f.js'
import { utf8ToString } from '../../../text/utf8/module.f.js'
import { emptyState, virtualOperationMap } from './module.f.js'

const endOfBody = empty()
const holdsNothing = pureOk(null)

/** A listener whose body identifies the clock handler it reached. @type {RequestListener<Now>} */
const reportedNow = () => resultMapStep(now(), r => ok({
    status: 200,
    headers: {},
    body: nonEmpty(utf8(String(assertOk(r))), endOfBody),
    release: holdsNothing,
}))

export const proof = /** @type {const} */ ({
    composedMapKeepsListenerRunner: () => {
        /** @type {number} */
        const clock = 123_456
        const customClock = clock + 1
        /** @type {PartialMemOperationMap<NodeOp, State>} */
        const operations = {
            ...virtualOperationMap,
            now: () => state => [state, ok(customClock)],
        }
        const run = partialRun(nodeCommands)(operations)
        const served = step(createServer(reportedNow), server => listen(server, 8_080, '127.0.0.1'))
        /** @type {readonly _QueuedRequest[]} */
        const requests = [{ method: 'GET', url: '/', headers: {}, body: [], chunkedResponse: true }]
        const [state, result] = run({ ...emptyState, epochNs: clock, requests })(both(now())(served))
        const [outer, listening] = assertOk(result)
        assertEq(assertOk(outer), customClock)
        assertEq(assertOk(listening), undefined)
        const [response] = state.responses
        assertEq(state.responses.length, 1)
        const [chunk] = response.body
        assertEq(response.body.length, 1)
        assertEq(utf8ToString(chunk), String(clock))
    },
})
