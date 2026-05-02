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
