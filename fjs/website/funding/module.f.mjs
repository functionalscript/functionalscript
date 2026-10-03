/**
 * The project's funding channels, read from `funding.json` for the footer
 * every page carries.
 *
 * **`funding.json` and not `.github/FUNDING.yml`.** `funding.json` holds each
 * channel's whole URL, and this repository already reads JSON. `FUNDING.yml`
 * holds usernames: reading it would take a YAML parser and a copy of the URL
 * pattern GitHub uses for each platform, which GitHub does not publish as a
 * rule. `FUNDING.yml` stays, because GitHub's Sponsor button reads it, so the
 * two files list the same channels and are kept in step by hand.
 *
 * **A channel the site cannot link is refused, not dropped.** The footer's
 * text is a channel's `description`, which the `funding.json` format leaves
 * optional. Without one, or with one that is empty or only spaces, there is
 * nothing to show: the link's only content would be its arrow, which is
 * hidden from a screen reader, so the link would have no name. And a footer
 * that silently lacks a channel is the plausible wrong answer
 * [DESIGN.md §10](../../../doc/DESIGN.md#10-refuse-what-you-cannot-handle)
 * refuses. An `address` that is not `https://` is refused for the same
 * reason: it would be a broken or unsafe link on every page.
 *
 * @module
 *
 * @import { Result } from '../../types/result/types.ts'
 * @import { Funding } from './types.ts'
 */

import { array, open, string } from '../../rtti/module.f.mjs'
import { parse as rttiParse } from '../../rtti/parse/module.f.mjs'
import { parse as parseJson } from '../../media/json/module.f.mjs'
import { error, ok } from '../../types/result/module.f.mjs'

/**
 * Where the funding channels are read from, relative to the repository root.
 *
 * @type {string}
 */
export const fundingPath = 'funding.json'

/**
 * The part of `funding.json` the footer reads. Open at every level, because
 * the format carries much more — the entity, the projects, the plans, a
 * channel's `type` — and none of it is the footer's business.
 */
const schema = open(/** @type {const} */ ({
    funding: open({
        channels: array(open({ address: string, description: string })),
    }),
}))

const parseSchema = rttiParse(schema)

/**
 * The funding channels in `text`, in the order `funding.json` lists them, or
 * why they cannot be linked.
 *
 * @type {(text: string) => Result<readonly Funding[], string>}
 */
export const parse = text => {
    const json = parseJson(text)
    if (json[0] === 'error') { return json }
    const parsed = parseSchema(json[1])
    if (parsed[0] === 'error') {
        const { path, message } = parsed[1]
        return error(`${path.join('.')}: ${message}`)
    }
    const channels = parsed[1].funding.channels
    const blank = channels.find(({ description }) => description.trim() === '')
    if (blank !== undefined) { return error(`blank description for ${blank.address}`) }
    const insecure = channels.find(({ address }) => !address.startsWith('https://'))
    return insecure === undefined
        ? ok(channels.map(({ description, address }) => ({ description, address })))
        : error(`not an https:// address: ${insecure.address}`)
}
