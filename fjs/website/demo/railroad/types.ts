/**
 * Type-level API for `fjs/website/demo/railroad/module.f.mjs`: a syntax
 * diagram — a railroad — any demo can hand a grammar to, once it has turned
 * that grammar into a {@link Diagram} of its own.
 *
 * @module
 */

import type { Rule } from '../../../ebnf/types.ts'
import type { Alphabet } from '../../../ebnf/railroad/types.ts'

/**
 * One piece of track. A diagram is read left to right, and every piece is
 * entered on the left and left on the right, on one horizontal line: its
 * track.
 *
 * - `terminal` — text the input must hold, drawn as a pill;
 * - `category` — any one of a kind of text, such as an identifier, by the
 *   kind's name, drawn as a grey pill with that name in italics, so it is
 *   not read as the text itself. Grey keeps the terminal's colour for text
 *   the input holds; the italics are the ECMAScript specification's own
 *   convention, which sets *IdentifierName* and *StringLiteral* in italics
 *   and the text an input holds, `=>`, in monospace, and they still tell
 *   the two apart where colour does not;
 * - `nonTerminal` — another diagram, by name, drawn as a box that links to
 *   it;
 * - `skip` — plain track, the way past an optional piece;
 * - `sequence` — its pieces one after another;
 * - `choice` — one of its pieces: the first on the track, the rest stacked
 *   below it, each on a branch of its own;
 * - `loop` — the first piece once, then again as many times as a reader
 *   likes, each return running back underneath through the second piece,
 *   the separator. A `skip` separator is a loop with nothing between the
 *   copies.
 */
export type Diagram =
    | readonly ['terminal', string]
    | readonly ['category', string]
    | readonly ['nonTerminal', string]
    | readonly ['skip']
    | readonly ['sequence', readonly Diagram[]]
    | readonly ['choice', readonly [Diagram, ...Diagram[]]]
    | readonly ['loop', Diagram, Diagram]

/**
 * The kinds of piece drawn as a box with a label — a terminal's or a
 * category's pill, a non-terminal's box: the tags of the pieces that carry
 * a name. The stylesheet selects each by this kind, so a kind it names is
 * one a diagram draws.
 */
export type BoxKind = Extract<Diagram, readonly [string, string]>[0]

/**
 * A rule a grammar's page draws, under its title:
 *
 * - `[title, rule]` — a source rule, the grammar itself or one it reaches;
 * - `[title, rule, tag]` — the branch `tag` of the source variant `rule`,
 *   a rule the grammar writes inline rather than names.
 */
export type Selection =
    | readonly [string, Rule]
    | readonly [string, Rule, string]

/**
 * What `grammarDemo` needs to draw a grammar's page:
 *
 * - `grammar` — the rule the page draws, lowered once;
 * - `alphabet` — what its symbols are: their labels, and which join into
 *   one literal;
 * - `description` — the intro's first clause, saying what the grammar is;
 * - `guide` — the intro's last sentence, saying how to read the diagrams:
 *   a page over text passes `codePointGuide`, and a page over tokens says
 *   what its category pills are;
 * - `selections` — the diagrams, in the order the page shows them.
 */
export type GrammarPage = {
    readonly grammar: Rule
    readonly alphabet: Alphabet
    readonly description: string
    readonly guide: string
    readonly selections: readonly Selection[]
}
