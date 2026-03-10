// ============================================================
// math.js — Probability & Statistics Functions
//
// CS109 concepts implemented here:
//   - MLE parameter estimation for Normal distribution
//   - Normal PDF and CDF
//   - Sum of independent random variables (E[T], Var[T])
//   - Central Limit Theorem approximation
//   - Win probability computation via Normal CDF
// ============================================================


// ── Normal Distribution ──────────────────────────────────────

/**
 * Normal probability density function
 * f(x) = (1 / σ√2π) * exp(−(x−μ)² / 2σ²)
 */
function normalPDF(x, mu, sigma) {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

/**
 * Normal cumulative distribution function
 * Uses Horner's method approximation of erf
 * P(X ≤ x) = Φ((x − μ) / σ)
 */
function normalCDF(x, mu, sigma) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
}

/**
 * Error function approximation (Abramowitz & Stegun)
 * Max error ≈ 1.5e-7
 */
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 +
    t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}


// ── MLE Parameter Estimation ─────────────────────────────────

/**
 * MLE estimate of mu (mean) for a Normal distribution
 * μ̂ = (1/n) * Σxᵢ
 */
function mleMean(scores) {
  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

/**
 * MLE estimate of sigma (std dev) for a Normal distribution
 * σ̂² = (1/n) * Σ(xᵢ − μ̂)²
 * Note: This uses the MLE biased estimator (divide by n), not
 * the unbiased sample variance (divide by n-1).
 */
function mleSigma(scores) {
  const mu = mleMean(scores);
  const variance = scores.reduce((s, x) => s + (x - mu) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}


// ── Lineup Aggregation ───────────────────────────────────────

/**
 * Compute combined lineup distribution stats.
 *
 * By independence of players:
 *   E[T] = Σ μᵢ
 *   Var[T] = Σ σᵢ²
 *   σ_T = √(Var[T])
 *
 * By the Central Limit Theorem, the sum of many independent
 * random variables converges to a Normal distribution, so we
 * model the total as T ~ N(E[T], Var[T]).
 *
 * @param {Array} players - array of player objects with mu, sigma
 * @returns {{ mu, sigma, variance, count }} | null
 */
function getLineupStats(players) {
  if (!players || players.length === 0) return null;
  const mu = players.reduce((s, p) => s + p.mu, 0);
  const variance = players.reduce((s, p) => s + p.sigma * p.sigma, 0);
  const sigma = Math.sqrt(variance);
  return { mu, sigma, variance, count: players.length };
}


// ── Win Probability ──────────────────────────────────────────

/**
 * Probability that lineup total beats opponent's projected score.
 *
 * P(T > opp) = 1 − Φ((opp − μ_T) / σ_T)
 *
 * where Φ is the standard Normal CDF.
 *
 * @param {number} mu    - lineup total mean
 * @param {number} sigma - lineup total std dev
 * @param {number} opp   - opponent's projected score
 * @returns {number} probability in [0, 1]
 */
function winProbability(mu, sigma, opp) {
  return 1 - normalCDF(opp, mu, sigma);
}
