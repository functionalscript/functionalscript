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
 * drawn by its name wherever another schema uses it. A use of the expanded
 * root schema is an arrow back to its definition, routed around the graph.
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
 * @import { DemoExample } from './types.ts'
 */

import { lessons as schemaLessons } from './guide/schemas/module.f.mjs'
import { lessons as readerLessons } from './guide/readers/module.f.mjs'
import { lessons as outputLessons } from './guide/outputs/module.f.mjs'
import { lessons as inTheProject } from './guide/in-the-project/module.f.mjs'
import { schemaDemo } from './schema-demo/module.f.mjs'

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
 * Schemas the project uses, each owned by the page of the guide's
 * [`in-the-project`](./guide/in-the-project/module.f.mjs) area that names the
 * modules declaring it, and imported from there. Each value is one the schema
 * accepts, so a reader starts from a working document and breaks it.
 *
 * @type {readonly DemoExample[]}
 */
export const projectSchemas = inTheProject

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
