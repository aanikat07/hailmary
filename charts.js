// ============================================================
// charts.js — Canvas Drawing Functions
//
// Two chart types:
//   drawMiniDist  — small sparkline distribution for player cards
//   drawMainDist  — full distribution curve for the right panel,
//                   with win/loss shading and opponent line
// ============================================================

const POS_COLORS = {
  QB: '#ff6b35',
  RB: '#00e5a0',
  WR: '#4d9fff',
  TE: '#c97dff',
  K:  '#ffd166',
  DST: '#ff4d6d',
  FLEX: '#4d9fff',
};


/**
 * Draw a small Normal distribution sparkline on a canvas element.
 * Used on player cards and lineup slot cards.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} mu        - MLE mean
 * @param {number} sigma     - MLE std dev
 * @param {string} posColor  - hex color for the position
 */
function drawMiniDist(canvas, mu, sigma, posColor) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth || 200;
  const H = canvas.height = 28;
  ctx.clearRect(0, 0, W, H);

  const minX = mu - 3.5 * sigma;
  const maxX = mu + 3.5 * sigma;
  const steps = 80;

  let maxY = 0;
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * (maxX - minX) / steps;
    const y = normalPDF(x, mu, sigma);
    vals.push(y);
    if (y > maxY) maxY = y;
  }

  // Filled area
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const px = (i / steps) * W;
    const py = H - (vals[i] / maxY) * (H - 2) - 1;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, posColor + 'aa');
  grad.addColorStop(1, posColor + '11');
  ctx.fillStyle = grad;
  ctx.fill();

  // Curve line
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const px = (i / steps) * W;
    const py = H - (vals[i] / maxY) * (H - 2) - 1;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.strokeStyle = posColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}


/**
 * Draw the main score distribution chart in the right panel.
 *
 * - If oppScore provided: shades win region (green) and loss region (red)
 *   and draws a vertical opponent line
 * - Always draws a dashed vertical line at the mean (μ)
 * - Labels the x-axis with min and max values
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} mu        - lineup total mean (E[T])
 * @param {number} sigma     - lineup total std dev
 * @param {number|null} oppScore - opponent's projected score, or null
 */
function drawMainDist(canvas, mu, sigma, oppScore) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const minX = Math.max(0, mu - 4 * sigma);
  const maxX = mu + 4 * sigma;
  const steps = 200;

  // Build curve values
  let maxY = 0;
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * (maxX - minX) / steps;
    const y = normalPDF(x, mu, sigma);
    vals.push({ x, y });
    if (y > maxY) maxY = y;
  }

  // Convert data coords to pixel coords
  const toPixel = (x, y) => ({
    px: ((x - minX) / (maxX - minX)) * W,
    py: H - 10 - (y / maxY) * (H - 20),
  });

  if (oppScore !== null) {
    const oppPx = ((oppScore - minX) / (maxX - minX)) * W;

    // Win region (right of opp line) — green
    ctx.beginPath();
    let started = false;
    vals.forEach(({ x, y }) => {
      const { px, py } = toPixel(x, y);
      if (px >= oppPx) {
        if (!started) { ctx.moveTo(Math.max(oppPx, px), py); started = true; }
        else ctx.lineTo(px, py);
      }
    });
    ctx.lineTo(W, H - 10);
    ctx.lineTo(Math.max(0, oppPx), H - 10);
    ctx.closePath();
    const grad1 = ctx.createLinearGradient(0, 0, 0, H);
    grad1.addColorStop(0, '#00e5a044');
    grad1.addColorStop(1, '#00e5a011');
    ctx.fillStyle = grad1;
    ctx.fill();

    // Loss region (left of opp line) — red
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => {
      const { px, py } = toPixel(x, y);
      if (px <= oppPx) {
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
    });
    ctx.lineTo(Math.min(W, oppPx), H - 10);
    ctx.lineTo(0, H - 10);
    ctx.closePath();
    const grad2 = ctx.createLinearGradient(0, 0, 0, H);
    grad2.addColorStop(0, '#ff6b3533');
    grad2.addColorStop(1, '#ff6b3508');
    ctx.fillStyle = grad2;
    ctx.fill();

  } else {
    // No opponent — fill whole curve in blue
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => {
      const { px, py } = toPixel(x, y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.lineTo(W, H - 10);
    ctx.lineTo(0, H - 10);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#4d9fff44');
    grad.addColorStop(1, '#4d9fff11');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Curve line
  ctx.beginPath();
  vals.forEach(({ x, y }, i) => {
    const { px, py } = toPixel(x, y);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.strokeStyle = '#4d9fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mean dashed line
  const muPx = ((mu - minX) / (maxX - minX)) * W;
  ctx.beginPath();
  ctx.moveTo(muPx, 5);
  ctx.lineTo(muPx, H - 10);
  ctx.strokeStyle = '#00e5a077';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Mean label
  ctx.font = `${10 * dpr / dpr}px IBM Plex Mono`;
  ctx.fillStyle = '#00e5a0aa';
  ctx.fillText(`μ=${mu.toFixed(0)}`, muPx + 4, 16);

  // Opponent vertical line
  if (oppScore !== null && oppScore >= minX && oppScore <= maxX) {
    const oppPx = ((oppScore - minX) / (maxX - minX)) * W;
    ctx.beginPath();
    ctx.moveTo(oppPx, 5);
    ctx.lineTo(oppPx, H - 10);
    ctx.strokeStyle = '#ff6b35cc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '10px IBM Plex Mono';
    ctx.fillStyle = '#ff6b35';
    ctx.fillText(`OPP: ${oppScore}`, oppPx + 4, 16);
  }

  // Baseline
  ctx.beginPath();
  ctx.moveTo(0, H - 10);
  ctx.lineTo(W, H - 10);
  ctx.strokeStyle = '#1e2330';
  ctx.lineWidth = 1;
  ctx.stroke();

  // X-axis labels
  ctx.font = '9px IBM Plex Mono';
  ctx.fillStyle = '#5a6070';
  ctx.fillText(minX.toFixed(0), 2, H - 1);
  ctx.textAlign = 'right';
  ctx.fillText(maxX.toFixed(0), W - 2, H - 1);
  ctx.textAlign = 'left';
}
