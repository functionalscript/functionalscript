/**
 * A schema, drawn as a graph under its code, what rtti derives from it, and a
 * value as you type it, with what `parse` and `validate` make of the value
 * under it.
 *
 * **A schema is picked, not typed.** It is a JavaScript value built from
 * functions, which no text box can spell, so the reader picks an example and
 * types only the value.
 *
 * **The value is a DataJS document, not JSON.** A schema describes values
 * JSON cannot write — `undefined`, a bigint, `-0`, `NaN` — and a value one
 * schema of a pair accepts has to be typeable, or the pair can show only half
 * its lesson. DataJS also writes sharing, so a reader can see `validate` hand
 * back the shared value it was given while `parse` builds a copy per use. The
 * results are written back as DataJS by the same codec.
 *
 * **Lessons, then the project's own schemas.** The drop-down has a group of
 * lessons for each area of the guide — schemas written to show one rule each,
 * every one owned by the guide page that explains the rule and shown on that
 * page too — and then one more group, of schemas the project itself uses,
 * imported from the modules that declare them, each with a value it accepts.
 *
 * **One schema, or two where the difference is the lesson.** A lesson shows
 * a single schema or a pair. A pair shows both schemas, each a block with a
 * radio dot, and the reader picks one while the value stays put, so the one
 * thing that changes is the schema. The schemas'
 * own code tells them apart, so they carry no names.
 *
 * **The graph is the schema as written**, walked by
 * `fjs/website/demo/graph`: a struct or a tuple is a node with a port per
 * member, an `or`, `array`, `record` or `rest` is a node over what it
 * combines, and a built-in or a constant draws inline in its parent's port.
 * One sub-schema used in two places is one node with two incoming edges.
 * **A named thunk is a definition**: it is expanded where it is the root and
 * drawn by its name wherever another schema uses it — which is what keeps a
 * recursive schema, whose thunk reaches itself, a graph the layout can rank.
 *
 * **One schema, many outputs.** Under the graph come the TypeScript type
 * `fjs/rtti/ts` prints, the JSON Schema `fjs/media/json/schema` converts it
 * to, and the canonical data form both are printed from — the outputs a
 * consumer gets from the one declaration besides the two readers.
 *
 * **Code is coloured by what wrote it.** The JSON Schema, the canonical form
 * and the readers' answers are marked by the writers that print them; the
 * schema's source and the value a reader types have no writer behind them,
 * so they go through the highlighter's tokenizer. The TypeScript type is
 * marked by its printer. The comparison's lines, `equal → true`, stay plain:
 * they are a summary rather than code.
 *
 * **A schema compares with any other.** The shown schema is compared with one
 * the reader picks, through the data form's `equal` and `subset`, so "two
 * spellings, one set" is a verdict the page computes rather than a claim. A
 * pair compares its two schemas until the reader picks another.
 *
 * **A failure points into the value.** When `validate` refuses the value, the
 * value is written again with the member its error path reaches marked.
 *
 * **The machinery is a factory**, `schemaDemo` in
 * [`schema-demo`](./schema-demo/module.f.mjs), so a guide page's demo is the
 * same demo over that page's lessons alone.
 *
 * **It needs no operations.** Every part is a pure function of the state, so
 * `update` declares `never` and returns through `pureOk`.
 *
 * @module
 *
 * @import { DemoExample, DemoSchema, Type } from './types.ts'
 */

import { lessons as schemaLessons } from './guide/schemas/module.f.mjs'
import { lessons as readerLessons } from './guide/readers/module.f.mjs'
import { lessons as outputLessons } from './guide/outputs/module.f.mjs'
import { schemaDemo } from './schema-demo/module.f.mjs'
import { request } from '../protocol/json_rpc/module.f.mjs'
import { tool } from '../protocol/mcp/module.f.mjs'
import { casAddArgs } from '../mcp/cas/module.f.mjs'
import { evoAddArgs } from '../mcp/evo/module.f.mjs'
import { revisionSchema } from '../media/revision/module.f.mjs'
import { lockSchema } from '../media/lock/module.f.mjs'
import { noteSchema } from '../media/note/module.f.mjs'
import { unknown as jsonValue } from '../media/json/rtti/module.f.mjs'
import { unknown as jsonSchema } from '../media/json/schema/module.f.mjs'
import { gitHubActionSchema } from '../ci/common/module.f.mjs'
import { jobTimeout } from '../ci/config/module.f.js'
import { op1Id } from '../edag/module.f.mjs'
import { value as edagValue } from '../edag/value/module.f.mjs'
import { dirent } from '../effects/schema/module.f.mjs'
import { fundingSchema } from '../website/funding/module.f.mjs'

/**
 * The lessons: schemas written to show one rule each, every one owned by the
 * guide page that explains its rule, one group per area of the guide
 * ([`guide/schemas`](./guide/schemas/module.f.mjs),
 * [`guide/readers`](./guide/readers/module.f.mjs),
 * [`guide/outputs`](./guide/outputs/module.f.mjs)).
 *
 * @type {readonly DemoExample[]}
 */
export const lessons = [...schemaLessons, ...readerLessons, ...outputLessons]

/**
 * A schema the project itself declares, shown as the import of its export
 * from the module that holds it, so what the reader picks is the schema the
 * code runs, not a copy that could drift from it.
 *
 * @type {(name: string, module: string, schema: Type) => readonly [DemoSchema]}
 */
const inProject = (name, module, schema) => [{ source: name, schema, module: `fjs/${module}` }]

/**
 * Schemas the project uses, one for each module that declares a schema and
 * reads values with it — protocols, media formats, JSON itself, CI, the
 * expression graph, data-shaped effects and the site. Each value
 * is one the schema accepts, so a reader starts from a working document and
 * breaks it.
 *
 * Three modules use rtti without a schema of their own, so they have no
 * entry: `fjs/media` matches a blob against the format schemas below,
 * `fjs/edag/value/metadata` checks an evaluated value's metadata with rtti's
 * error helpers after `fjs/edag/value`'s shape check, and `fjs/nanvm` checks
 * its operator cases against `fjs/edag`'s `op1Id` and `op3Id` with
 * `validate`.
 *
 * @type {readonly DemoExample[]}
 */
export const projectSchemas = [
    {
        name: 'JSON-RPC request',
        about: 'A JSON-RPC 2.0 request; without an id it is a notification. open(), so a peer on a later protocol revision can add members. Read with parse.',
        schemas: inProject('request', 'protocol/json_rpc', request),
        value: 'export default {"jsonrpc":"2.0","method":"tools/list","id":1};',
    },
    {
        name: 'MCP tool',
        about: 'A tool an MCP server advertises in tools/list: a name, a description, and the JSON Schema of its arguments. Read with parse.',
        schemas: inProject('tool', 'protocol/mcp', tool),
        value: 'export default {"name":"cas_get","description":"Read a blob by its hash","inputSchema":{"type":"object","properties":{"hash":{"type":"string"}},"required":["hash"]}};',
    },
    {
        name: 'cas_add arguments',
        about: 'The arguments of the cas_add MCP tool. One schema is both the inputSchema the server advertises and the check its arguments pass. Closed: the server defines the vocabulary.',
        schemas: inProject('casAddArgs', 'mcp/cas', casAddArgs),
        value: 'export default {"content":"hello","type":"text"};',
    },
    {
        name: 'evo_add arguments',
        about: 'The arguments of the evo_add MCP tool: a new revision. Its lock is the revision format\'s own lockField schema, a recursive map, reused rather than restated.',
        schemas: inProject('evoAddArgs', 'mcp/evo', evoAddArgs),
        value: 'export default {"parents":["b7m2mnk9w0vqwhh4"],"subject":"todo","snapshot":"c1dq3pe0t4f7a2kx"};',
    },
    {
        name: 'Revision',
        about: 'vnd.fjs.revision: one step in the history of a mutable object over a content-addressable store. open(), so an older reader still reads a revision a newer writer extended.',
        schemas: inProject('revisionSchema', 'media/revision', revisionSchema),
        value: 'export default {"dialect":"vnd.fjs.revision","subject":"todo","parents":[],"snapshot":"c1dq3pe0t4f7a2kx","generation":0};',
    },
    {
        name: 'Lock',
        about: 'vnd.fjs.lock: a lock map as a blob of its own, so several revisions can share one resolution. The map nests: a value is a hash or another map.',
        schemas: inProject('lockSchema', 'media/lock', lockSchema),
        value: 'export default {"dialect":"vnd.fjs.lock","lock":{"fjs":"c1dq3pe0t4f7a2kx","deps":{"left-pad":"b7m2mnk9w0vqwhh4"}}};',
    },
    {
        name: 'Note',
        about: 'vnd.fjs.note: a note, todo or issue as a blob: its text, what it depends on, and a priority from P1 to P5.',
        schemas: inProject('noteSchema', 'media/note', noteSchema),
        value: 'export default {"dialect":"vnd.fjs.note","text":"Show the project\'s own schemas in the rtti demo","priority":"P2"};',
    },
    {
        name: 'Any JSON value',
        about: 'The JSON data model as a schema: a primitive, an object of JSON values, or an array of them. Recursive, so the graph draws the use of unknown by its name.',
        schemas: inProject('unknown', 'media/json/rtti', jsonValue),
        value: 'export default {"name":"fjs","tags":["data","schema"],"stars":42,"private":false,"homepage":null};',
    },
    {
        name: 'JSON Schema',
        about: 'A JSON Schema (draft 2020-12) object, the target toJsonSchema converts rtti schemas into. Recursive: a schema\'s properties and items are schemas.',
        schemas: inProject('unknown', 'media/json/schema', jsonSchema),
        value: 'export default {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]};',
    },
    {
        name: 'GitHub Actions workflow',
        about: 'A workflow as this repository generates it. Closed: CI reads its own generated workflows back, so a key the schema does not name is generator drift.',
        schemas: inProject('gitHubActionSchema', 'ci/common', gitHubActionSchema),
        value: `export default {"name":"CI","on":{"pull_request":{}},"permissions":{"contents":"read"},"jobs":{"test":{"runs-on":"ubuntu-latest","timeout-minutes":${jobTimeout},"steps":[{"uses":"actions/checkout@v5"},{"run":"npm test"}]}}};`,
    },
    {
        name: 'Unary operator',
        about: 'The unary operators of the expression graph, as a union of strings. The VM\'s operator cases check membership with validate, the one project use that keeps the value.',
        schemas: inProject('op1Id', 'edag', op1Id),
        value: 'export default "typeof";',
    },
    {
        name: 'Evaluated EDAG value',
        about: 'An evaluated value of the expression graph: data, and functions whose captures are values. Recursive. Read with validate, so a checked value keeps its identity and sharing.',
        schemas: inProject('value', 'edag/value', edagValue),
        value: 'export default ["[]",[1,"a",["undefined"]]];',
    },
    {
        name: 'Directory entry',
        about: 'An entry readdir answers, described by a data-validation schema in effects/schema. The corresponding handwritten TypeScript operation declarations are checked against schema-derived types.',
        schemas: inProject('dirent', 'effects/schema', dirent),
        value: 'export default {"name":"module.f.mjs","parentPath":"fjs/rtti","isFile":true,"isDirectory":false};',
    },
    {
        name: 'Funding channels',
        about: 'funding.json as the site footer reads it: only the funding channels. open() at every level, because the format carries much more and none of it is the footer\'s business.',
        schemas: inProject('fundingSchema', 'website/funding', fundingSchema),
        value: 'export default {"version":"v1.0.0","funding":{"channels":[{"guid":"github","type":"other","address":"https://github.com/sponsors/sergey-shandar","description":"GitHub Sponsors"}]}};',
    },
]

/** Every example, lessons first, in the order the drop-down lists them. */
export const examples = [...lessons, ...projectSchemas]

/**
 * The module page's demo: every example, the lessons of each area of the
 * guide and then the schemas the project uses, in a group each.
 */
export const demo = schemaDemo([
    ['Schemas', schemaLessons],
    ['Readers', readerLessons],
    ['Outputs', outputLessons],
    ['Used in this project', projectSchemas],
])
