// charts.js — Canvas Drawing

const POS_COLORS = {
  QB: '#ff6b35', RB: '#00e5a0', WR: '#4da6ff',
  TE: '#c97dff', K: '#ffd166', DST: '#f87171', FLEX: '#4da6ff'
};

function drawMiniDist(canvas, mu, sigma, color) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.offsetWidth || 180;
  const H = canvas.height = 20;
  ctx.clearRect(0, 0, W, H);
  const minX = mu - 3.5 * sigma, maxX = mu + 3.5 * sigma;
  const steps = 60;
  let maxY = 0;
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    const y = normalPDF(minX + i * (maxX - minX) / steps, mu, sigma);
    vals.push(y); if (y > maxY) maxY = y;
  }
  ctx.beginPath();
  vals.forEach((y, i) => {
    const px = (i / steps) * W, py = H - (y / maxY) * (H - 2) - 1;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, color + '88'); g.addColorStop(1, color + '11');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath();
  vals.forEach((y, i) => {
    const px = (i / steps) * W, py = H - (y / maxY) * (H - 2) - 1;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawMainDist(canvas, mu, sigma, oppScore, myColor) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // color: green for my panel, blue for opp panel
  const color = myColor || '#00e5a0';
  const minX = Math.max(0, mu - 4 * sigma), maxX = mu + 4 * sigma;
  const steps = 200;
  let maxY = 0;
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * (maxX - minX) / steps;
    const y = normalPDF(x, mu, sigma);
    vals.push({ x, y }); if (y > maxY) maxY = y;
  }

  const px = x => ((x - minX) / (maxX - minX)) * W;
  const py = y => H - 10 - (y / maxY) * (H - 20);

  if (oppScore !== null) {
    const ox = px(oppScore);
    // Win region (score > oppScore) — green fill
    ctx.beginPath();
    let started = false;
    vals.forEach(({ x, y }) => {
      const p = px(x);
      if (p >= ox) {
        if (!started) { ctx.moveTo(Math.max(ox, p), py(y)); started = true; }
        else ctx.lineTo(p, py(y));
      }
    });
    ctx.lineTo(W, H - 10); ctx.lineTo(Math.max(0, ox), H - 10); ctx.closePath();
    const g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, '#00e5a044'); g1.addColorStop(1, '#00e5a008');
    ctx.fillStyle = g1; ctx.fill();
    // Loss region — blue fill (opponent's territory)
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => {
      const p = px(x);
      if (p <= ox) { i === 0 ? ctx.moveTo(p, py(y)) : ctx.lineTo(p, py(y)); }
    });
    ctx.lineTo(Math.min(W, ox), H - 10); ctx.lineTo(0, H - 10); ctx.closePath();
    const g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, '#4da6ff33'); g2.addColorStop(1, '#4da6ff08');
    ctx.fillStyle = g2; ctx.fill();
  } else {
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => { i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y)); });
    ctx.lineTo(W, H - 10); ctx.lineTo(0, H - 10); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, color + '44'); g.addColorStop(1, color + '08');
    ctx.fillStyle = g; ctx.fill();
  }

  // Curve line
  ctx.beginPath();
  vals.forEach(({ x, y }, i) => { i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y)); });
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();

  // Mean dashed line
  ctx.beginPath(); ctx.moveTo(px(mu), 4); ctx.lineTo(px(mu), H - 10);
  ctx.strokeStyle = color + '55'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = '9px DM Mono'; ctx.fillStyle = color + '99';
  ctx.fillText(`μ=${mu.toFixed(0)}`, px(mu) + 3, 13);

  // Opponent score line — blue
  if (oppScore !== null) {
    const ox = px(oppScore);
    ctx.beginPath(); ctx.moveTo(ox, 4); ctx.lineTo(ox, H - 10);
    ctx.strokeStyle = '#4da6ffcc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '9px DM Mono'; ctx.fillStyle = '#4da6ff';
    ctx.fillText(`OPP:${oppScore.toFixed(0)}`, ox + 3, 13);
  }

  // Baseline
  ctx.beginPath(); ctx.moveTo(0, H - 10); ctx.lineTo(W, H - 10);
  ctx.strokeStyle = '#1d2130'; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = '8px DM Mono'; ctx.fillStyle = '#4a5068';
  ctx.fillText(minX.toFixed(0), 2, H - 2);
  ctx.textAlign = 'right'; ctx.fillText(maxX.toFixed(0), W - 2, H - 2); ctx.textAlign = 'left';
}

// Two overlapping distributions for matchup cards
// color1 = green (you), color2 = blue (opp)
function drawMatchupDist(canvas, p1, p2, color1, color2) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const allMus = [p1.mu, p2.mu];
  const allSigmas = [p1.sigma, p2.sigma];
  const minX = Math.max(0, Math.min(...allMus) - 3.5 * Math.max(...allSigmas));
  const maxX = Math.max(...allMus) + 3.5 * Math.max(...allSigmas);
  const steps = 150;
  let maxY = 0;
  const v1 = [], v2 = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * (maxX - minX) / steps;
    const y1 = normalPDF(x, p1.mu, p1.sigma);
    const y2 = normalPDF(x, p2.mu, p2.sigma);
    v1.push({ x, y: y1 }); v2.push({ x, y: y2 });
    if (y1 > maxY) maxY = y1; if (y2 > maxY) maxY = y2;
  }

  const px = x => ((x - minX) / (maxX - minX)) * W;
  const py = y => H - 6 - (y / maxY) * (H - 10);

  const drawCurve = (vals, color) => {
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => { i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y)); });
    ctx.lineTo(W, H - 6); ctx.lineTo(0, H - 6); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, color + '55'); g.addColorStop(1, color + '0a');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    vals.forEach(({ x, y }, i) => { i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y)); });
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  };

  drawCurve(v1, color1);
  drawCurve(v2, color2);
}

// Difference distribution for battle screen
// Green = you win region, Blue = opponent wins region
function drawDiffDist(canvas, mu_D, sigma_D) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth, H = canvas.offsetHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const minX = mu_D - 4 * sigma_D, maxX = mu_D + 4 * sigma_D;
  const steps = 200;
  let maxY = 0;
  const vals = [];
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * (maxX - minX) / steps;
    const y = normalPDF(x, mu_D, sigma_D);
    vals.push({ x, y }); if (y > maxY) maxY = y;
  }

  const px = x => ((x - minX) / (maxX - minX)) * W;
  const py = y => H - 10 - (y / maxY) * (H - 18);
  const zeroPx = px(0);

  // Win region (D > 0) — green
  ctx.beginPath();
  let s = false;
  vals.forEach(({ x, y }) => {
    const p = px(x);
    if (p >= zeroPx) {
      if (!s) { ctx.moveTo(Math.max(zeroPx, p), py(y)); s = true; }
      else ctx.lineTo(p, py(y));
    }
  });
  ctx.lineTo(W, H - 10); ctx.lineTo(Math.max(0, zeroPx), H - 10); ctx.closePath();
  const g1 = ctx.createLinearGradient(0, 0, 0, H);
  g1.addColorStop(0, '#00e5a055'); g1.addColorStop(1, '#00e5a00a');
  ctx.fillStyle = g1; ctx.fill();

  // Loss region — blue (opponent territory)
  ctx.beginPath();
  vals.forEach(({ x, y }, i) => {
    const p = px(x);
    if (p <= zeroPx) { i === 0 ? ctx.moveTo(p, py(y)) : ctx.lineTo(p, py(y)); }
  });
  ctx.lineTo(Math.min(W, zeroPx), H - 10); ctx.lineTo(0, H - 10); ctx.closePath();
  const g2 = ctx.createLinearGradient(0, 0, 0, H);
  g2.addColorStop(0, '#4da6ff44'); g2.addColorStop(1, '#4da6ff0a');
  ctx.fillStyle = g2; ctx.fill();

  // Gold curve
  ctx.beginPath();
  vals.forEach(({ x, y }, i) => { i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y)); });
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke();

  // Zero line
  ctx.beginPath(); ctx.moveTo(zeroPx, 4); ctx.lineTo(zeroPx, H - 10);
  ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);

  // Labels
  ctx.font = '9px DM Mono';
  ctx.fillStyle = '#00e5a0aa'; ctx.fillText('YOU WIN →', zeroPx + 6, 14);
  ctx.fillStyle = '#4da6ffaa'; ctx.textAlign = 'right'; ctx.fillText('← OPP WINS', zeroPx - 6, 14); ctx.textAlign = 'left';
  ctx.fillStyle = '#4a5068';
  ctx.fillText(minX.toFixed(0), 2, H - 2);
  ctx.textAlign = 'right'; ctx.fillText(maxX.toFixed(0), W - 2, H - 2); ctx.textAlign = 'left';
}