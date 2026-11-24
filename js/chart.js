(function (global) {
  "use strict";

  function computeRollingAverage(allWeights, targetDateStr) {
    const endDate = global.MealStore.parseLocalDate(targetDateStr).getTime();
    const startDate = endDate - 6 * 86400000;
    const windowItems = allWeights.filter((w) => {
      const t = global.MealStore.parseLocalDate(w.date).getTime();
      return t >= startDate && t <= endDate;
    });
    if (windowItems.length === 0) return null;
    const sum = windowItems.reduce((acc, item) => acc + item.kg, 0);
    return Math.round((sum / windowItems.length) * 10) / 10;
  }

  function filterByRange(weights, range) {
    if (!weights.length || range === "all") return weights.slice();
    const days = Number(range) || 30;
    const todayStr = global.MealStore.toLocalDateStr(new Date());
    const latestStr = weights[weights.length - 1].date > todayStr
      ? weights[weights.length - 1].date
      : todayStr;
    const cutoffStr = global.MealStore.addDays(latestStr, -(days - 1));
    return weights.filter((w) => w.date >= cutoffStr);
  }

  function renderWeightChart(container, tooltipEl, allWeights, range, goalWeight) {
    container.innerHTML = "";
    const data = filterByRange(allWeights, range);

    if (data.length === 0) {
      container.innerHTML = `<div class="empty-state">Log your weight in kg above to see your chart plot.</div>`;
      tooltipEl.textContent = "No entries in this date range yet";
      return;
    }

    const enriched = data.map((item) => ({
      ...item,
      avg7: computeRollingAverage(allWeights, item.date)
    }));

    const W = 360;
    const H = 210;
    const pad = { top: 16, right: 14, bottom: 28, left: 42 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const values = [];
    enriched.forEach((p) => {
      values.push(p.kg);
      if (p.avg7 !== null) values.push(p.avg7);
    });
    if (typeof goalWeight === "number" && !Number.isNaN(goalWeight)) {
      values.push(goalWeight);
    }

    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    if (maxY - minY < 1.5) {
      const mid = (maxY + minY) / 2;
      minY = mid - 1.0;
      maxY = mid + 1.0;
    } else {
      const margin = (maxY - minY) * 0.14;
      minY -= margin;
      maxY += margin;
    }
    minY = Math.floor(minY * 2) / 2;
    maxY = Math.ceil(maxY * 2) / 2;
    const ySpan = Math.max(0.5, maxY - minY);

    const minTime = global.MealStore.parseLocalDate(enriched[0].date).getTime();
    const maxTime = global.MealStore.parseLocalDate(enriched[enriched.length - 1].date).getTime();
    const tSpan = Math.max(86400000, maxTime - minTime);

    function xFor(dateStr) {
      if (enriched.length === 1) return pad.left + plotW / 2;
      const t = global.MealStore.parseLocalDate(dateStr).getTime();
      return pad.left + ((t - minTime) / tSpan) * plotW;
    }

    function yFor(kg) {
      return pad.top + plotH - ((kg - minY) / ySpan) * plotH;
    }

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "chart-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Weight trend chart in kilograms");

    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `
      <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    // Grid lines & Y-axis labels
    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const val = minY + (ySpan * i) / ticks;
      const y = yFor(val);
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(pad.left));
      line.setAttribute("x2", String(W - pad.right));
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("y2", y.toFixed(1));
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-opacity", "0.12");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(pad.left - 6));
      label.setAttribute("y", (y + 3.5).toFixed(1));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#94a3b8");
      label.textContent = val.toFixed(1);
      svg.appendChild(label);
    }

    // X-axis date labels (start, mid, end)
    const xLabelIndices = enriched.length === 1
      ? [0]
      : enriched.length === 2
        ? [0, 1]
        : [0, Math.floor((enriched.length - 1) / 2), enriched.length - 1];

    const seenX = new Set();
    xLabelIndices.forEach((idx) => {
      if (seenX.has(idx)) return;
      seenX.add(idx);
      const pt = enriched[idx];
      const d = global.MealStore.parseLocalDate(pt.date);
      const txt = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", xFor(pt.date).toFixed(1));
      label.setAttribute("y", String(H - 6));
      label.setAttribute("text-anchor", idx === 0 && enriched.length > 1 ? "start" : idx === enriched.length - 1 && enriched.length > 1 ? "end" : "middle");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#94a3b8");
      label.textContent = txt;
      svg.appendChild(label);
    });

    // Goal weight line
    if (typeof goalWeight === "number" && !Number.isNaN(goalWeight)) {
      const gy = yFor(goalWeight);
      const gLine = document.createElementNS(ns, "line");
      gLine.setAttribute("x1", String(pad.left));
      gLine.setAttribute("x2", String(W - pad.right));
      gLine.setAttribute("y1", gy.toFixed(1));
      gLine.setAttribute("y2", gy.toFixed(1));
      gLine.setAttribute("stroke", "#f59e0b");
      gLine.setAttribute("stroke-width", "1.5");
      gLine.setAttribute("stroke-dasharray", "5 4");
      svg.appendChild(gLine);

      const gText = document.createElementNS(ns, "text");
      gText.setAttribute("x", String(W - pad.right - 2));
      gText.setAttribute("y", (gy - 4).toFixed(1));
      gText.setAttribute("text-anchor", "end");
      gText.setAttribute("font-size", "9.5");
      gText.setAttribute("font-weight", "600");
      gText.setAttribute("fill", "#f59e0b");
      gText.textContent = `Goal ${goalWeight.toFixed(1)} kg`;
      svg.appendChild(gText);
    }

    // Area & daily polyline
    if (enriched.length > 1) {
      const dailyPts = enriched.map((p) => `${xFor(p.date).toFixed(1)},${yFor(p.kg).toFixed(1)}`);
      const areaPts = [
        `${xFor(enriched[0].date).toFixed(1)},${(pad.top + plotH).toFixed(1)}`,
        ...dailyPts,
        `${xFor(enriched[enriched.length - 1].date).toFixed(1)},${(pad.top + plotH).toFixed(1)}`
      ];

      const area = document.createElementNS(ns, "polygon");
      area.setAttribute("points", areaPts.join(" "));
      area.setAttribute("fill", "url(#weightAreaGrad)");
      svg.appendChild(area);

      const line = document.createElementNS(ns, "polyline");
      line.setAttribute("points", dailyPts.join(" "));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", "#10b981");
      line.setAttribute("stroke-width", "2.4");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-linejoin", "round");
      svg.appendChild(line);

      // 7-day rolling average polyline
      const avgPts = enriched
        .filter((p) => p.avg7 !== null)
        .map((p) => `${xFor(p.date).toFixed(1)},${yFor(p.avg7).toFixed(1)}`);
      if (avgPts.length > 1) {
        const avgLine = document.createElementNS(ns, "polyline");
        avgLine.setAttribute("points", avgPts.join(" "));
        avgLine.setAttribute("fill", "none");
        avgLine.setAttribute("stroke", "#38bdf8");
        avgLine.setAttribute("stroke-width", "1.8");
        avgLine.setAttribute("stroke-dasharray", "4 3");
        svg.appendChild(avgLine);
      }
    }

    // Interactive points
    const dots = [];
    function selectPoint(idx) {
      const item = enriched[idx];
      dots.forEach((d, i) => {
        d.setAttribute("r", i === idx ? "5.5" : "3.6");
        d.setAttribute("stroke-width", i === idx ? "2.5" : "1.5");
      });
      const avgTxt = item.avg7 !== null ? ` · 7d avg: ${item.avg7.toFixed(1)} kg` : "";
      const noteTxt = item.note ? ` · ${item.note}` : "";
      tooltipEl.textContent = `${item.date}: ${item.kg.toFixed(1)} kg${avgTxt}${noteTxt}`;
    }

    enriched.forEach((p, idx) => {
      const cx = xFor(p.date).toFixed(1);
      const cy = yFor(p.kg).toFixed(1);

      const dot = document.createElementNS(ns, "circle");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("r", "3.6");
      dot.setAttribute("fill", "#10b981");
      dot.setAttribute("stroke", "#0b1120");
      dot.setAttribute("stroke-width", "1.5");
      svg.appendChild(dot);
      dots.push(dot);

      const hit = document.createElementNS(ns, "circle");
      hit.setAttribute("cx", cx);
      hit.setAttribute("cy", cy);
      hit.setAttribute("r", "14");
      hit.setAttribute("fill", "transparent");
      hit.style.cursor = "pointer";
      hit.addEventListener("click", () => selectPoint(idx));
      svg.appendChild(hit);
    });

    container.appendChild(svg);
    selectPoint(enriched.length - 1);
  }

  global.WeightChart = {
    computeRollingAverage,
    renderWeightChart
  };
})(window);
