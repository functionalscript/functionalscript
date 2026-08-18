/**
 * Types for the stdio transport of JSON-RPC / MCP servers.
 *
 * @module
 */

import type { Unknown } from '../../../media/json/types.ts'
import type { Operation } from '../../../effects/types.ts'
import type { Effect } from '../../../effects/io/types.ts'
import type { Response } from '../../json_rpc/types.ts'

/**
 * A transport step: maps one parsed JSON-RPC message to a response, or `null`
 * for a notification that needs no reply. The shape of
 * `mcpStep(config)(handlers)(key)`.
 */
export type Step<O extends Operation> = (value: Unknown) => Effect<O, Response | null, never>
