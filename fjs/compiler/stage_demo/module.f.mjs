/**
 * The skeleton every compiler stage's demo page shares, so that a page
 * supplies only its intro, its stage and its view: source in, the stage, its
 * output or its refusal out. A new stage page starts from these rather than
 * from a copy of another page.
 *
 * - {@link stageDemo} is the page around the stage: a `Source` field,
 *   highlighted, over [the compiler's shared examples](../examples/module.f.js),
 *   opening on the first.
 * - {@link parsed} is the step every stage after the tokenizer begins with:
 *   the front end over the text, its refusal as the parser's message.
 *
 * The view an output stage ends in, a copyable code block or the refusal, is
 * not compiler-specific and lives with the highlighter as `codeOutput`
 * ([`website/demo/highlight`](../../website/demo/highlight/module.f.mjs)).
 *
 * @module
 *
 * @import { AstModule } from '../ast/types.ts'
 * @import { Node } from '../../media/html/types.ts'
 * @import { Result } from '../../types/result/types.ts'
 * @import { Demo, DemoEvent, TextDemoOptions } from '../../website/demo/types.ts'
 */

import { error } from '../../types/result/module.f.js'
import { textDemo } from '../../website/demo/module.f.mjs'
import { highlight } from '../../website/demo/highlight/module.f.mjs'
import { examples } from '../examples/module.f.js'
import { parse } from '../transpiler/module.f.mjs'

/**
 * A stage's page: `intro` above a `Source` field named `name`, which opens on
 * the shared list's first example and offers the whole list, and then what
 * `render` draws from the text.
 *
 * @type {(o: Pick<TextDemoOptions, 'intro' | 'name'>) => (render: (text: string) => readonly Node[]) => Demo<string, DemoEvent>}
 */
export const stageDemo = ({ intro, name }) => textDemo({
    intro,
    name,
    label: 'Source',
    init: examples[0][1],
    examples,
    highlight,
})

/**
 * `stage` over the AST of `text`, or the parser's message where `text` does
 * not parse.
 *
 * @type {<T>(stage: (ast: AstModule) => Result<T, string>) => (text: string) => Result<T, string>}
 */
export const parsed = stage => text => {
    const result = parse('')(text)
    return result[0] === 'error' ? error(result[1].message) : stage(result[1])
}
