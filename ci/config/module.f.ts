// https://docs.github.com/en/actions/reference/runners/github-hosted-runners#standard-github-hosted-runners-for-public-repositories
export const images = {
    ubuntu: {
        intel: 'ubuntu-24.04',
        arm: 'ubuntu-24.04-arm'
    },
    macos: {
        intel: 'macos-26-intel',
        arm: 'macos-26'
    },
    windows: {
        intel: 'windows-2025',
        arm: 'windows-11-arm',
    }
} as const

// https://bun.sh/
export const bun = '1.3.13'

// https://deno.com/
export const deno = '2.7.14'

// https://www.npmjs.com/package/playwright
export const playwright = '1.59.1'

// https://rust-lang.org/
export const rust = '1.95.0'

// https://nodejs.org/en/download
export const node = {
    default: '26.1.0',
    others: ['20', '22', '24'],
} as const
