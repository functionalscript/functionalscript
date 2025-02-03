type Sequence = readonly Rule[]

type Or = { readonly[k in string]: Rule }

type InputRange = number

type Id = string

type Rule = Or | Sequence | InputRange | Id
