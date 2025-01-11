export type Fs = {
   readonly readFileSync: (name: string) => string | null
   readonly writeFileSync: (name: string) => (content: string) => Fs
}