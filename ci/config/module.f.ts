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

export const bun = '1.3.13'
