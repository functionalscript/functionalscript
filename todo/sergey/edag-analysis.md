Every EDAG can have multiple scopes of potential memoization. Each lazy (potentially not running) expression forme a new zone.
For example, `a ? b : c` forms two new scopes `b` and `c`.

Sadly, JS has no expressions that can declare `const` inside, only statements, so some expressions would be hard
to serialize back to FJS.
