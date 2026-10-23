/**
 * The schemas of [`README.md`](./README.md), the protocols and MCP tools: one
 * declaration is both the decoder and the static type, as the page's demo and
 * the module page's demo show them: each imported from the module that
 * declares it, with a value it accepts.
 *
 * @module
 *
 * @import { DemoExample } from '../../../types.ts'
 */

import { projectSchema } from '../../../schema-demo/module.f.mjs'
import { request } from '../../../../protocol/json_rpc/module.f.mjs'
import { tool } from '../../../../protocol/mcp/module.f.mjs'
import { casAddArgs } from '../../../../mcp/cas/module.f.mjs'
import { evoAddArgs } from '../../../../mcp/evo/module.f.mjs'

/** @type {readonly DemoExample[]} */
export const lessons = [
    {
        name: 'JSON-RPC request',
        about: 'A JSON-RPC 2.0 request; without an id it is a notification. open(), so a peer on a later protocol revision can add members. Read with parse.',
        schemas: projectSchema('request', 'protocol/json_rpc', request),
        value: 'export default {"jsonrpc":"2.0","method":"tools/list","id":1};',
    },
    {
        name: 'MCP tool',
        about: 'A tool an MCP server advertises in tools/list: a name, a description, and the JSON Schema of its arguments. Read with parse.',
        schemas: projectSchema('tool', 'protocol/mcp', tool),
        value: 'export default {"name":"cas_get","description":"Read a blob by its hash","inputSchema":{"type":"object","properties":{"hash":{"type":"string"}},"required":["hash"]}};',
    },
    {
        name: 'cas_add arguments',
        about: 'The arguments of the cas_add MCP tool. One schema is both the inputSchema the server advertises and the check its arguments pass. Closed: the server defines the vocabulary.',
        schemas: projectSchema('casAddArgs', 'mcp/cas', casAddArgs),
        value: 'export default {"content":"hello","type":"text"};',
    },
    {
        name: 'evo_add arguments',
        about: 'The arguments of the evo_add MCP tool: a new revision. Its lock is the revision format\'s own lockField schema, a recursive map, reused rather than restated.',
        schemas: projectSchema('evoAddArgs', 'mcp/evo', evoAddArgs),
        value: 'export default {"parents":["b7m2mnk9w0vqwhh4"],"subject":"todo","snapshot":"c1dq3pe0t4f7a2kx"};',
    },
]
