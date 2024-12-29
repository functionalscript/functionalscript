export type Fs = {
   readonly readFileSync: (name: string) => string
   readonly writeFileSync: (name: string, content: string) => void
}