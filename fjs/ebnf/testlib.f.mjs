/**
 * Helpers shared by the proofs of the EBNF front end and its grammars.
 *
 * @module
 */

const { entries, fromEntries } = Object

/**
 * Expands a rule into plain data by calling every thunk it meets, so two
 * independently built rules can be compared structurally: a thunk is a
 * function, and functions are only ever the same as themselves.
 *
 * There is no depth limit, so this terminates on a rule that does not name
 * itself. A grammar that does — `json`, `dataJs` — is expanded by hand in
 * its proof, one thunk at a time.
 *
 * @type {(r: unknown) => unknown}
 */
export const force = r => {
    if (typeof r === 'function') { return force(r()) }
    if (r instanceof Array) { return r.map(force) }
    if (typeof r === 'object' && r !== null) {
        return fromEntries(entries(r).map(([k, v]) => [k, force(v)]))
    }
    return r
}
