# Average Word Length

## Setup

Let $q_s$ be the probability of input symbol $s$ for $s = 0, \ldots, n-1$, with $\sum_s q_s = 1$.

## Derivation

Define $L(s)$ as the expected number of additional symbols needed after having just read symbol $s$:

$$L(s) = 1 + \sum_{j < s} q_j \cdot L(j)$$

This satisfies the recurrence:

$$L(s) = L(s-1) \cdot (1 + q_{s-1})$$

which telescopes to:

$$L(s) = \prod_{j=0}^{s-1}(1 + q_j)$$

The expected word length is:

$$E[\text{length}] = \sum_{s=0}^{n-1} q_s \cdot (1 + L(s)) = 1 + \sum_{s=0}^{n-1} q_s \cdot L(s)$$

Using the telescoping identity $\sum_s q_s \cdot \prod_{j<s}(1+q_j) = \prod_s(1+q_s) - 1$:

$$\boxed{E[\text{length}] = \prod_{s=0}^{n-1}(1 + q_s)}$$

## Limit as $n \to \infty$

As $n \to \infty$, each $q_s \to 0$ while $\sum_s q_s = 1$. Using $\ln\prod(1+q_s) = \sum\ln(1+q_s)$:

$$\sum_s \ln(1+q_s) = \sum_s \left(q_s - \frac{q_s^2}{2} + \cdots\right) = 1 - \frac{\sum q_s^2}{2} + \cdots$$

As $\max(q_s) \to 0$, we have $\sum q_s^2 \leq \max(q_s) \cdot \sum q_s \to 0$, so:

$$E[\text{length}] \to e$$

## Verification

- Level 1 (binary input, $q_0 = q_1 = \tfrac{1}{2}$):
  $E = \left(\tfrac{3}{2}\right)^2 = \tfrac{9}{4} = 2.25$

- Level 2 (Level-1 symbols as input, $q_0=q_1=q_4=\tfrac{1}{4}$, $q_2=q_3=\tfrac{1}{8}$):
  $E = \left(\tfrac{5}{4}\right)^3 \cdot \left(\tfrac{9}{8}\right)^2 = \tfrac{10125}{4096} \approx 2.47$

| Level    | $n$ | $E$                        | $\ln E$         |
|----------|-----|----------------------------|-----------------|
| 1        | 2   | $9/4 = 2.25$               | $0.811$         |
| 2        | 5   | $10125/4096 \approx 2.473$ | $0.905$         |
| 3        | 129 | $\approx 2.675$            | $\approx 0.984$ |
| $\infty$ |     | $e \approx 2.718$          | $1$             |

## Expected bits per word

**[Wald's identity][wald-wiki]** ([Wald 1944], [Durrett 2019] §4.1.1) lets us chain the expected
word lengths across levels to get the expected number of bits per word at any level.

**Wald's identity.**
Let $X_1, X_2, \ldots$ be i.i.d. with $E[|X_1|] < \infty$, and
let $N$ be a stopping time with $E[N] < \infty$. Then

$$E\!\left[\sum_{i=1}^{N} X_i\right] = E[N] \cdot E[X_1].$$

**Application.** In a uniform bit stream, consecutive level-$k$ symbols $s_1, s_2, \ldots$ are
i.i.d. with distribution $q$. The word boundary $N$ is a stopping time: $\{N \geq n\}$ is
determined by $s_1, \ldots, s_{n-1}$, while $X_n = \operatorname{bits}(s_n)$ depends only on
$s_n$, which is independent of the past. Therefore

$$E[X_n \cdot \mathbf{1}_{N \geq n}] = E[X_n] \cdot P(N \geq n),$$

and summing over $n$ gives Wald's identity with $E[X_1] = b_k$, the expected bits per level-$k$
word.

**Recursion.** Writing $b_k$ for the expected bits per level-$k$ word with $b_0 = 1$:

$$b_k = E_k \cdot b_{k-1} = \prod_{j=1}^{k} E_j$$

| Level $k$ | $E_k$           | $b_k$                      |
|-----------|-----------------|----------------------------|
| 1         | $9/4$           | $9/4 \approx 2.25$         |
| 2         | $10125/4096$    | $91125/16384 \approx 5.56$ |
| 3         | $\approx 2.675$ | $\approx 14.88$            |
| $\infty$  | $e$             | grows without bound        |

## References

- \[Wald 1944\] A. Wald, "On cumulative sums of random variables," *Ann. Math. Statist.* **15**(3),
  pp. 283–296, 1944. [doi:10.1214/aoms/1177731235](https://doi.org/10.1214/aoms/1177731235)
- \[Durrett 2019\] R. Durrett, *Probability: Theory and Examples*, 5th ed., Cambridge University
  Press, 2019. [PDF](https://services.math.duke.edu/~rtd/PTE/PTE5_011119.pdf)

[wald-wiki]: https://en.wikipedia.org/wiki/Wald%27s_equation
[Wald 1944]: #references
[Durrett 2019]: #references
