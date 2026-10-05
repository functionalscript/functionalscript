/**
 * Types for `fjs/website/funding/module.f.mjs`: one funding channel as the
 * website links it.
 *
 * @module
 */

/**
 * One way to fund the project, as a link: what a reader sees and where it
 * goes. Both come from one channel of `funding.json`.
 */
export type Funding = {
    /** The link's text: the channel's `description`, such as `Patreon`. */
    readonly description: string
    /** Where the link goes: the channel's `address`, an `https://` URL. */
    readonly address: string
}
