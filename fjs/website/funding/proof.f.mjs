import { assertEq, assertStructurallySame } from '../../asserts/module.f.mjs'
import { fundingPath, parse } from './module.f.mjs'

/** @type {(channels: readonly unknown[]) => string} */
const fundingJson = channels => JSON.stringify({
    version: 'v1.0.0',
    funding: { channels, plans: [] },
})

export const proof = {
    path: () => assertEq(fundingPath, 'funding.json'),
    /**
     * **Every channel becomes a link, in the file's order**, and the fields
     * the footer does not read — a channel's `guid` and `type`, the plans —
     * are passed over.
     */
    channels: () => assertStructurallySame(
        parse(fundingJson([
            { guid: 'github', type: 'other', address: 'https://github.com/sponsors/x', description: 'GitHub Sponsors' },
            { guid: 'patreon', type: 'other', address: 'https://patreon.com/x', description: 'Patreon' },
        ])),
        ['ok', [
            { description: 'GitHub Sponsors', address: 'https://github.com/sponsors/x' },
            { description: 'Patreon', address: 'https://patreon.com/x' },
        ]]),
    none: () => assertStructurallySame(parse(fundingJson([])), ['ok', []]),
    refused: {
        notJson: () => assertEq(parse('{')[0], 'error'),
        // A footer link needs its text, so a channel without one is refused
        // rather than shown as a bare URL or left out.
        noDescription: () => {
            const result = parse(fundingJson([{ address: 'https://example.com' }]))
            assertEq(result[0] === 'error' && result[1].startsWith('funding.channels.0'), true)
        },
        // An empty or blank description would leave a link whose only content
        // is its arrow, hidden from a screen reader: a link with no name.
        emptyDescription: () => assertStructurallySame(
            parse(fundingJson([{ address: 'https://example.com', description: '' }])),
            ['error', 'blank description for https://example.com']),
        blankDescription: () => assertStructurallySame(
            parse(fundingJson([{ address: 'https://example.com', description: '  ' }])),
            ['error', 'blank description for https://example.com']),
        notHttps: () => assertStructurallySame(
            parse(fundingJson([{ address: 'http://example.com', description: 'x' }])),
            ['error', 'not an https:// address: http://example.com']),
    },
}
