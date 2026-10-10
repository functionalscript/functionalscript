/**
 * Type-level API for `fjs/website/demo/railroad/module.f.mjs`: a syntax
 * diagram — a railroad — any demo can hand a grammar to, once it has turned
 * that grammar into a {@link Diagram} of its own.
 *
 * @module
 */

/**
 * One piece of track. A diagram is read left to right, and every piece is
 * entered on the left and left on the right, on one horizontal line: its
 * track.
 *
 * - `terminal` — text the input must hold, drawn as a pill;
 * - `category` — any one of a kind of text, such as an identifier, by the
 *   kind's name, drawn as a pill with that name in italics, so it is not
 *   read as the text itself: the ECMAScript specification's own convention,
 *   which sets *IdentifierName* and *StringLiteral* in italics and the text
 *   an input holds, `=>`, in monospace;
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
