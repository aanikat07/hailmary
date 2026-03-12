// ============================================================
// math.js — Probability & Statistics Functions
// ============================================================

function normalPDF(x, mu, sigma) {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function normalCDF(x, mu, sigma) {
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly = t * (0.254829592 + t * (-0.284496736 +
    t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = 1 - poly * Math.exp(-x * x);
  return x >= 0 ? result : -result;
}

function mleMean(scores) {
  return scores.reduce((s, x) => s + x, 0) / scores.length;
}

function mleSigma(scores) {
  const mu = mleMean(scores);
  const variance = scores.reduce((s, x) => s + (x - mu) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

// Get MLE params using only data up to (but not including) the target week.
// In early weeks (few data points), we use bootstrap resampling to estimate
// the standard error of mu-hat, then add it to sigma to reflect parameter uncertainty.
// This means early-week distributions are wider — honestly capturing that we don't
// yet have enough data to trust the MLE estimate. As n grows, the bootstrap SE
// shrinks toward zero and sigma converges to pure score variance.
function getMleAtWeek(player, targetWeek) {
  const priorScores = [];
  for (let w = 1; w < targetWeek; w++) {
    const s = player.week_scores[String(w)];
    if (s !== undefined) priorScores.push(s);
  }
  if (priorScores.length < 2) return null;

  const mu    = mleMean(priorScores);
  const sigma = Math.max(0.1, mleSigma(priorScores));

  // Bootstrap SE of mu-hat — quantifies how uncertain we are about mu itself.
  // With n=3 games this is large; with n=14 games it's negligible.
  // We only run bootstrap when n < 10 to save compute; beyond that SE is small enough to ignore.
  let bootstrapSE = 0;
  const n = priorScores.length;
  if (n < 10) {
    const nB = 300;
    const bootMeans = [];
    for (let b = 0; b < nB; b++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += priorScores[Math.floor(Math.random() * n)];
      bootMeans.push(sum / n);
    }
    const bootMu  = bootMeans.reduce((a, x) => a + x, 0) / nB;
    bootstrapSE   = Math.sqrt(bootMeans.reduce((a, x) => a + (x - bootMu) ** 2, 0) / nB);
  }

  // Inflate sigma by bootstrap SE — wider distribution in early weeks, tighter as data accumulates
  const adjustedSigma = Math.sqrt(sigma * sigma + bootstrapSE * bootstrapSE);

  return { mu, sigma: adjustedSigma, rawSigma: sigma, bootstrapSE, scores: priorScores };
}

// Get actual score for a given week (or null if didn't play)
function getActualScore(player, week) {
  const s = player.week_scores[String(week)];
  return s !== undefined ? s : null;
}

// E[T] = sum(mu_i), Var[T] = sum(sigma_i^2), T ~ Normal by CLT
// If targetWeek provided, uses MLE params from prior weeks only
function getLineupStats(players, targetWeek) {
  if (!players || players.length === 0) return null;
  let totalMu = 0, totalVar = 0;
  for (const p of players) {
    let mu, sigma;
    if (targetWeek && targetWeek > 2) {
      const mle = getMleAtWeek(p, targetWeek);
      mu = mle ? mle.mu : p.mu;
      sigma = mle ? mle.sigma : p.sigma;
    } else {
      mu = p.mu; sigma = p.sigma;
    }
    totalMu += mu;
    totalVar += sigma * sigma;
  }
  return { mu: totalMu, sigma: Math.sqrt(totalVar), variance: totalVar, count: players.length };
}

// D = T_you - T_opp ~ N(mu_you - mu_opp, sigma_you^2 + sigma_opp^2)
// P(win) = P(D > 0) = 1 - CDF(0; mu_D, sigma_D)
function winProbabilityVsDistribution(myStats, oppStats) {
  if (!myStats || !oppStats) return null;
  const mu_D = myStats.mu - oppStats.mu;
  const sigma_D = Math.sqrt(myStats.variance + oppStats.variance);
  return 1 - normalCDF(0, mu_D, sigma_D);
}

function winProbabilityVsScore(mu, sigma, oppScore) {
  return 1 - normalCDF(oppScore, mu, sigma);
}

// Bootstrap CI on mu — simulates sampling distribution of mu-hat
function bootstrapCI(scores, nBootstrap = 500) {
  const n = scores.length;
  const means = [];
  for (let b = 0; b < nBootstrap; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += scores[Math.floor(Math.random() * n)];
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return {
    lower: means[Math.floor(0.025 * nBootstrap)],
    upper: means[Math.floor(0.975 * nBootstrap)]
  };
}

// Logistic Regression — Boom/Bust Predictor
// Trained on 12,941 weekly game examples from 2025-26 NFL season
// Features: [recent_form_vs_mean, week_norm, recent_vol_ratio, cold_streak, momentum, cv]
// Label: 1 if player scored above their season median that week
// Training accuracy: 75.4%
// Gradient descent: lr=0.1, 300 epochs, binary cross-entropy loss
const LR_MODEL = {
  weights: [-0.17398007657720216, 0.008459960161062355, 0.7151633333479405,
             0.2674677950980761,  0.16213616216141566, -0.18064054510946417],
  bias: -1.3206483234627215,
  feat_means: [-0.00992485345850289, 0.5951808433751369, 0.38152927437786516,
                0.40653736187311645, -0.0012237343178239934, 1.434515506169397],
  feat_stds:  [0.4757191608489598, 0.28315151243771397, 0.5225861381668505,
               0.491187068495026, 1.112372353049733, 1.7995345917422867]
};

function sigmoid(z) {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
}

function rollingMean(scores, window) {
  const relevant = scores.slice(-window).filter(s => s > 0);
  return relevant.length ? relevant.reduce((a, b) => a + b, 0) / relevant.length : 0;
}

function rollingStd(scores, window) {
  const relevant = scores.slice(-window).filter(s => s > 0);
  if (relevant.length < 2) return 0;
  const m = relevant.reduce((a, b) => a + b, 0) / relevant.length;
  return Math.sqrt(relevant.reduce((s, x) => s + (x - m) ** 2, 0) / relevant.length);
}

// computeBoomProb — week-aware out-of-sample prediction
// If targetWeek provided, uses ONLY data from weeks before targetWeek (proper holdout)
// This is genuine out-of-sample prediction: fit on weeks 1..W-1, predict week W
function computeBoomProb(player, targetWeek) {
  let scores, mu, sigma;

  if (targetWeek && targetWeek > 2) {
    const mle = getMleAtWeek(player, targetWeek);
    if (!mle || mle.scores.length < 2) return 0.3; // not enough prior data
    scores = mle.scores;
    mu = mle.mu;
    sigma = mle.sigma;
  } else {
    scores = player.scores;
    mu = player.mu;
    sigma = player.sigma;
  }

  const n = scores.length;
  const sigma_ = sigma + 1e-9;

  // Feature 1: recent form vs season mean (normalized)
  const rm3 = rollingMean(scores, 3);
  const recentFormNorm = (rm3 - mu) / sigma_;

  // Feature 2: how far into the season
  const weekNorm = (targetWeek || n) / 17.0;

  // Feature 3: recent volatility ratio
  const rs3 = rollingStd(scores, 3);
  const recentVolRatio = rs3 / sigma_;

  // Feature 4: cold last week (binary)
  const cold = scores[n - 1] < mu * 0.7 ? 1.0 : 0.0;

  // Feature 5: momentum
  const momentum = n >= 2 ? (scores[n - 1] - scores[n - 2]) / sigma_ : 0;

  // Feature 6: coefficient of variation
  const cv = sigma_ / (mu + 1e-9);

  const raw = [recentFormNorm, weekNorm, recentVolRatio, cold, momentum, cv];
  const norm = raw.map((v, j) => (v - LR_MODEL.feat_means[j]) / LR_MODEL.feat_stds[j]);
  const z = LR_MODEL.bias + norm.reduce((s, v, j) => s + LR_MODEL.weights[j] * v, 0);
  return sigmoid(z);
}

// Classify player archetype — week-aware if targetWeek provided
function getArchetype(player, targetWeek) {
  let mu, sigma, scores;
  if (targetWeek && targetWeek > 2) {
    const mle = getMleAtWeek(player, targetWeek);
    if (mle) { mu = mle.mu; sigma = mle.sigma; scores = mle.scores; }
    else { mu = player.mu; sigma = player.sigma; scores = player.scores; }
  } else {
    mu = player.mu; sigma = player.sigma; scores = player.scores;
  }
  const cv = sigma / (mu + 1e-9);
  const zeroRate = scores.filter(s => s === 0).length / scores.length;
  if (zeroRate > 0.2)  return { label: "INJURY RISK",   color: "#ff4d6d" };
  if (cv < 0.4)        return { label: "FLOOR MONSTER", color: "#00e5a0" };
  if (cv > 0.8)        return { label: "BOOM/BUST",     color: "#ff6b35" };
  if (cv < 0.6)        return { label: "CONSISTENT",    color: "#4d9fff" };
  return                { label: "BALANCED",            color: "#ffd166" };
}
