(function () {
  "use strict";

  const Store = window.MealStore;
  const Chart = window.WeightChart;

  let state = Store.loadState();
  let selectedDate = Store.toLocalDateStr(new Date());
  let activeTab = "today";
  let blockCategoryFilter = "All";
  let chartRange = "30";
  let pickerState = { slotId: null, mode: "library", portion: 1 };
  let firedAlerts = new Set();

  // DOM helpers
  const $ = (id) => document.getElementById(id);

  function showToast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.add("hidden"), 2400);
  }

  function applyTheme() {
    const isLight = state.settings.theme === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");
    $("btn-theme-toggle").textContent = isLight ? "Light" : "Dark";
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", isLight ? "#f1f5f9" : "#0b1120");
  }

  function persistAndRender() {
    const ok = Store.saveState(state);
    if (!ok) showToast("Warning: browser storage is full");
    renderAll();
  }

  function openModal(id) {
    $(id).classList.remove("hidden");
  }

  function closeModal(id) {
    $(id).classList.add("hidden");
  }

  function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll(".tab-panel").forEach((p) => {
      p.classList.toggle("active", p.id === `tab-${tabName}`);
    });
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    if (tabName === "weight") renderWeightTab();
    if (tabName === "schedule") renderScheduleTab();
  }

  // ---------- HEADER MACROS ----------
  function renderHeaderMacros() {
    const slots = Store.ensureDaySlots(state, selectedDate);
    let totalCal = 0;
    let totalProt = 0;
    let eatenCal = 0;
    let eatenProt = 0;

    slots.forEach((s) => {
      if (!s.name) return;
      totalCal += s.calories;
      totalProt += s.protein;
      if (s.eaten) {
        eatenCal += s.calories;
        eatenProt += s.protein;
      }
    });

    totalCal = Math.round(totalCal);
    totalProt = Math.round(totalProt * 10) / 10;
    eatenCal = Math.round(eatenCal);
    eatenProt = Math.round(eatenProt * 10) / 10;

    const calTarget = state.targets.calories;
    const protTarget = state.targets.protein;

    $("cal-total").textContent = totalCal;
    $("cal-target").textContent = calTarget;
    const calDiff = calTarget - totalCal;
    $("cal-remaining").textContent =
      calDiff >= 0 ? `${calDiff} left` : `${Math.abs(calDiff)} over`;
    $("cal-eaten").textContent = `Eaten: ${eatenCal}`;
    const calPct = Math.min(100, Math.round((totalCal / Math.max(1, calTarget)) * 100));
    const calBar = $("cal-bar");
    calBar.style.width = `${calPct}%`;
    calBar.classList.toggle("over", totalCal > calTarget);

    $("prot-total").textContent = totalProt;
    $("prot-target").textContent = protTarget;
    const protDiff = Math.round((protTarget - totalProt) * 10) / 10;
    $("prot-remaining").textContent =
      protDiff >= 0 ? `${protDiff}g left` : `+${Math.abs(protDiff)}g`;
    $("prot-eaten").textContent = `Eaten: ${eatenProt}g`;
    const protPct = Math.min(100, Math.round((totalProt / Math.max(1, protTarget)) * 100));
    $("prot-bar").style.width = `${protPct}%`;
  }

  // ---------- TODAY / MEAL SLOTS ----------
  function renderTodayTab() {
    const todayStr = Store.toLocalDateStr(new Date());
    $("date-picker").value = selectedDate;
    $("date-friendly").textContent = Store.formatFriendlyDate(selectedDate);
    $("btn-today-jump").classList.toggle("hidden", selectedDate === todayStr);

    const slots = Store.ensureDaySlots(state, selectedDate);
    const filledCount = slots.filter((s) => Boolean(s.name)).length;
    $("slot-count-badge").textContent = `${slots.length} slot${slots.length === 1 ? "" : "s"} (${filledCount} filled)`;

    const container = $("slots-list");
    container.innerHTML = "";

    if (slots.length === 0) {
      container.innerHTML = `<div class="card empty-state">No meal slots for this day. Tap <strong>+ Add Meal Slot</strong> below.</div>`;
      return;
    }

    slots.forEach((slot, idx) => {
      const card = document.createElement("div");
      card.className = `slot-card${slot.eaten ? " eaten" : ""}`;

      const top = document.createElement("div");
      top.className = "slot-top";

      const labelWrap = document.createElement("div");
      labelWrap.className = "slot-label-wrap";

      const checkBtn = document.createElement("button");
      checkBtn.type = "button";
      checkBtn.className = "eaten-check";
      checkBtn.setAttribute("aria-label", slot.eaten ? "Mark as not eaten" : "Mark as eaten");
      checkBtn.textContent = slot.eaten ? "✓" : "";
      checkBtn.addEventListener("click", () => {
        slot.eaten = !slot.eaten;
        persistAndRender();
      });

      const labelEl = document.createElement("span");
      labelEl.className = "slot-label";
      labelEl.textContent = slot.label || `Slot ${idx + 1}`;

      labelWrap.appendChild(checkBtn);
      labelWrap.appendChild(labelEl);

      const controls = document.createElement("div");
      controls.className = "slot-controls";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "mini-icon-btn";
      upBtn.textContent = "↑";
      upBtn.title = "Move up";
      upBtn.disabled = idx === 0;
      upBtn.addEventListener("click", () => {
        if (idx === 0) return;
        const tmp = slots[idx - 1];
        slots[idx - 1] = slots[idx];
        slots[idx] = tmp;
        persistAndRender();
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "mini-icon-btn";
      downBtn.textContent = "↓";
      downBtn.title = "Move down";
      downBtn.disabled = idx === slots.length - 1;
      downBtn.addEventListener("click", () => {
        if (idx >= slots.length - 1) return;
        const tmp = slots[idx + 1];
        slots[idx + 1] = slots[idx];
        slots[idx] = tmp;
        persistAndRender();
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "mini-icon-btn remove";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove slot";
      removeBtn.addEventListener("click", () => {
        slots.splice(idx, 1);
        persistAndRender();
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(removeBtn);
      top.appendChild(labelWrap);
      top.appendChild(controls);

      const body = document.createElement("div");
      body.className = "slot-body";

      const mealBtn = document.createElement("button");
      mealBtn.type = "button";
      mealBtn.className = `slot-meal-btn${slot.name ? " filled" : ""}`;
      mealBtn.addEventListener("click", () => openSlotPicker(slot.id));

      if (slot.name) {
        const left = document.createElement("div");
        left.style.minWidth = "0";
        const nameSpan = document.createElement("span");
        nameSpan.className = "slot-meal-name";
        nameSpan.textContent = slot.name;
        left.appendChild(nameSpan);

        const right = document.createElement("div");
        right.className = "slot-meal-macros";
        right.innerHTML = `<span class="slot-kcal">${Math.round(slot.calories)} kcal</span><span class="slot-prot">${slot.protein}g protein</span>`;

        mealBtn.appendChild(left);
        mealBtn.appendChild(right);
      } else {
        mealBtn.innerHTML = `<span class="slot-meal-empty">+ Tap to pick or swap a meal</span>`;
      }

      body.appendChild(mealBtn);

      const footer = document.createElement("div");
      footer.className = "slot-footer";

      const timeInput = document.createElement("input");
      timeInput.type = "time";
      timeInput.className = "slot-time-input";
      timeInput.value = slot.time || "";
      timeInput.setAttribute("aria-label", `Meal time for ${slot.label}`);
      timeInput.addEventListener("change", () => {
        slot.time = timeInput.value;
        persistAndRender();
      });

      const rightFooter = document.createElement("div");
      rightFooter.style.display = "flex";
      rightFooter.style.gap = "6px";
      rightFooter.style.alignItems = "center";

      if (slot.name && slot.portion && slot.portion !== 1) {
        const pTag = document.createElement("span");
        pTag.className = "portion-tag";
        pTag.textContent = `${slot.portion}×`;
        rightFooter.appendChild(pTag);
      }

      const swapBtn = document.createElement("button");
      swapBtn.type = "button";
      swapBtn.className = "chip-btn";
      swapBtn.textContent = slot.name ? "Swap / Edit" : "Choose";
      swapBtn.addEventListener("click", () => openSlotPicker(slot.id));
      rightFooter.appendChild(swapBtn);

      footer.appendChild(timeInput);
      footer.appendChild(rightFooter);

      card.appendChild(top);
      card.appendChild(body);
      card.appendChild(footer);
      container.appendChild(card);
    });
  }

  // ---------- PICKER MODAL ----------
  function setPickerMode(mode) {
    pickerState.mode = mode;
    document.querySelectorAll("[data-picker-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.pickerMode === mode);
    });
    $("picker-library-pane").classList.toggle("hidden", mode !== "library");
    $("picker-custom-form").classList.toggle("hidden", mode !== "custom");
  }

  function renderPickerList() {
    const query = $("picker-search").value.trim().toLowerCase();
    const mult = pickerState.portion;
    const list = $("picker-list");
    list.innerHTML = "";

    const matches = state.blocks.filter((b) => {
      if (!query) return true;
      return (
        b.name.toLowerCase().includes(query) ||
        (b.category && b.category.toLowerCase().includes(query)) ||
        (b.notes && b.notes.toLowerCase().includes(query))
      );
    });

    if (matches.length === 0) {
      list.innerHTML = `<div class="empty-state">No fixed blocks match. Switch to <strong>Custom / Edit Slot</strong> or create a block in the Meals tab.</div>`;
      return;
    }

    matches.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker-item";
      const cals = Math.round(b.calories * mult);
      const prot = Math.round(b.protein * mult * 10) / 10;

      const left = document.createElement("div");
      left.style.minWidth = "0";
      const title = document.createElement("div");
      title.className = "block-name";
      title.textContent = b.name;
      const sub = document.createElement("div");
      sub.className = "muted-small";
      sub.textContent = [b.category, b.defaultTime ? `Default ${b.defaultTime}` : ""].filter(Boolean).join(" · ");
      left.appendChild(title);
      left.appendChild(sub);

      const right = document.createElement("div");
      right.className = "slot-meal-macros";
      right.innerHTML = `<span class="slot-kcal">${cals} kcal</span><span class="slot-prot">${prot}g</span>`;

      btn.appendChild(left);
      btn.appendChild(right);
      btn.addEventListener("click", () => {
        const slots = Store.ensureDaySlots(state, selectedDate);
        const slot = slots.find((s) => s.id === pickerState.slotId);
        if (!slot) return;
        slot.blockId = b.id;
        slot.name = b.name;
        slot.calories = cals;
        slot.protein = prot;
        slot.portion = mult;
        if (!slot.time && b.defaultTime) slot.time = b.defaultTime;
        closeModal("modal-picker");
        persistAndRender();
      });

      list.appendChild(btn);
    });
  }

  function openSlotPicker(slotId) {
    const slots = Store.ensureDaySlots(state, selectedDate);
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    pickerState.slotId = slotId;
    pickerState.portion = slot.portion || 1;
    document.querySelectorAll("#picker-portions .chip-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.mult) === pickerState.portion);
    });

    $("picker-title").textContent = slot.label ? `Slot: ${slot.label}` : "Choose Meal";
    $("picker-search").value = "";
    $("slot-label-input").value = slot.label || "";
    $("slot-meal-name").value = slot.name || "";
    $("slot-meal-cals").value = slot.name ? slot.calories : "";
    $("slot-meal-prot").value = slot.name ? slot.protein : "";
    $("slot-meal-time").value = slot.time || "";

    setPickerMode("library");
    renderPickerList();
    openModal("modal-picker");
  }

  // ---------- FIXED MEAL BLOCKS TAB ----------
  function renderMealsTab() {
    $("block-count-badge").textContent = `${state.blocks.length} saved`;
    const cats = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Shake / Drink"];
    const chipsWrap = $("block-category-chips");
    chipsWrap.innerHTML = "";
    cats.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `chip-btn${blockCategoryFilter === cat ? " active" : ""}`;
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        blockCategoryFilter = cat;
        renderMealsTab();
      });
      chipsWrap.appendChild(btn);
    });

    const query = $("block-search").value.trim().toLowerCase();
    const list = $("blocks-list");
    list.innerHTML = "";

    const filtered = state.blocks.filter((b) => {
      if (blockCategoryFilter !== "All" && b.category !== blockCategoryFilter) return false;
      if (!query) return true;
      return (
        b.name.toLowerCase().includes(query) ||
        (b.notes && b.notes.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="card empty-state">No fixed meal blocks found. Tap <strong>+ New Block</strong> to create one.</div>`;
      return;
    }

    filtered.forEach((b) => {
      const card = document.createElement("div");
      card.className = "card block-card";

      const info = document.createElement("div");
      info.className = "block-info";

      const titleRow = document.createElement("div");
      titleRow.className = "block-title-row";
      const nameEl = document.createElement("span");
      nameEl.className = "block-name";
      nameEl.textContent = b.name;
      const catEl = document.createElement("span");
      catEl.className = "cat-pill";
      catEl.textContent = b.category;
      titleRow.appendChild(nameEl);
      titleRow.appendChild(catEl);

      const meta = document.createElement("div");
      meta.className = "block-meta";
      meta.innerHTML = `<strong style="color:var(--accent-cal)">${b.calories} kcal</strong> <strong style="color:var(--accent-prot)">${b.protein}g protein</strong>${b.defaultTime ? `<span>${b.defaultTime}</span>` : ""}`;

      info.appendChild(titleRow);
      info.appendChild(meta);
      if (b.notes) {
        const notesEl = document.createElement("div");
        notesEl.className = "block-notes";
        notesEl.textContent = b.notes;
        info.appendChild(notesEl);
      }

      const actions = document.createElement("div");
      actions.className = "block-actions";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "chip-btn active";
      addBtn.textContent = "+ To Day";
      addBtn.addEventListener("click", () => {
        const slots = Store.ensureDaySlots(state, selectedDate);
        const emptySlot = slots.find((s) => !s.name);
        if (emptySlot) {
          emptySlot.blockId = b.id;
          emptySlot.name = b.name;
          emptySlot.calories = b.calories;
          emptySlot.protein = b.protein;
          emptySlot.portion = 1;
          if (!emptySlot.time && b.defaultTime) emptySlot.time = b.defaultTime;
        } else {
          slots.push({
            id: Store.uid("slot"),
            label: b.category || `Meal ${slots.length + 1}`,
            time: b.defaultTime || "",
            blockId: b.id,
            name: b.name,
            calories: b.calories,
            protein: b.protein,
            portion: 1,
            eaten: false
          });
        }
        persistAndRender();
        showToast(`Added "${b.name}" to ${Store.formatFriendlyDate(selectedDate)}`);
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "chip-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => openBlockModal(b));

      actions.appendChild(addBtn);
      actions.appendChild(editBtn);

      card.appendChild(info);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function openBlockModal(block) {
    if (block) {
      $("block-modal-title").textContent = "Edit Fixed Meal Block";
      $("block-id").value = block.id;
      $("block-name").value = block.name;
      $("block-cals").value = block.calories;
      $("block-prot").value = block.protein;
      $("block-category").value = block.category || "Lunch";
      $("block-time").value = block.defaultTime || "";
      $("block-notes").value = block.notes || "";
      $("btn-delete-block").classList.remove("hidden");
    } else {
      $("block-modal-title").textContent = "New Fixed Meal Block";
      $("block-id").value = "";
      $("block-form").reset();
      $("btn-delete-block").classList.add("hidden");
    }
    openModal("modal-block");
  }

  // ---------- WEIGHT TAB ----------
  function renderWeightTab() {
    const weights = state.weights;
    const goal = state.targets.goalWeight;

    $("weight-goal-pill").textContent = goal ? `Goal: ${goal.toFixed(1)} kg` : "No goal set";
    $("legend-goal").classList.toggle("hidden", !goal);
    $("weight-count-badge").textContent = `${weights.length} entr${weights.length === 1 ? "y" : "ies"}`;

    if (weights.length > 0) {
      const latest = weights[weights.length - 1];
      const avg7 = Chart.computeRollingAverage(weights, latest.date);
      $("stat-latest").textContent = `${latest.kg.toFixed(1)} kg`;
      $("stat-avg7").textContent = avg7 !== null ? `${avg7.toFixed(1)} kg` : "-- kg";

      const weekAgoStr = Store.addDays(latest.date, -7);
      const pastCandidates = weights.filter((w) => w.date <= weekAgoStr);
      if (pastCandidates.length > 0) {
        const ref = pastCandidates[pastCandidates.length - 1];
        const diff = Math.round((latest.kg - ref.kg) * 10) / 10;
        $("stat-change").textContent = `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`;
      } else if (weights.length >= 2) {
        const first = weights[0];
        const diff = Math.round((latest.kg - first.kg) * 10) / 10;
        $("stat-change").textContent = `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`;
      } else {
        $("stat-change").textContent = "-- kg";
      }

      if (goal) {
        const diffGoal = Math.round((latest.kg - goal) * 10) / 10;
        $("stat-goal").textContent =
          diffGoal === 0 ? "At goal!" : `${diffGoal > 0 ? "+" : ""}${diffGoal.toFixed(1)} kg`;
      } else {
        $("stat-goal").textContent = "-- kg";
      }
    } else {
      $("stat-latest").textContent = "-- kg";
      $("stat-avg7").textContent = "-- kg";
      $("stat-change").textContent = "-- kg";
      $("stat-goal").textContent = goal ? `Goal ${goal.toFixed(1)}` : "-- kg";
    }

    Chart.renderWeightChart(
      $("weight-chart-container"),
      $("chart-tooltip"),
      weights,
      chartRange,
      goal
    );

    const hist = $("weight-history");
    hist.innerHTML = "";
    if (weights.length === 0) {
      hist.innerHTML = `<div class="card empty-state">No weights logged yet.</div>`;
      return;
    }

    weights
      .slice()
      .reverse()
      .forEach((entry) => {
        const row = document.createElement("div");
        row.className = "card weight-row";

        const left = document.createElement("div");
        left.className = "weight-row-left";
        const valEl = document.createElement("strong");
        valEl.textContent = `${entry.kg.toFixed(1)} kg`;
        const metaEl = document.createElement("div");
        metaEl.className = "weight-row-meta";
        metaEl.textContent = `${entry.date}${entry.note ? ` · ${entry.note}` : ""}`;
        left.appendChild(valEl);
        left.appendChild(metaEl);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "mini-icon-btn remove";
        delBtn.textContent = "×";
        delBtn.title = "Delete entry";
        delBtn.addEventListener("click", () => {
          state.weights = state.weights.filter((w) => w.date !== entry.date);
          persistAndRender();
        });

        row.appendChild(left);
        row.appendChild(delBtn);
        hist.appendChild(row);
      });
  }

  // ---------- SCHEDULE & TIMER TAB ----------
  function playChime() {
    if (!state.settings.sound) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.14;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.34);
      });
    } catch (_e) {
      // Ignore audio restrictions
    }
  }

  function notifyUser(title, body) {
    playChime();
    showToast(`${title}: ${body}`);
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch (_e) {
        // Ignore on unsupported mobile webviews
      }
    }
  }

  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function getNextScheduledMealTarget() {
    const todayStr = Store.toLocalDateStr(new Date());
    const slots = state.days[todayStr] || [];
    const now = new Date();
    const candidates = [];

    slots.forEach((slot) => {
      if (!slot.time || slot.eaten) return;
      const parts = slot.time.split(":").map(Number);
      if (parts.length !== 2 || parts.some(Number.isNaN)) return;
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        parts[0],
        parts[1],
        0,
        0
      );
      const diff = target.getTime() - now.getTime();
      if (diff >= -59000) {
        candidates.push({
          slot,
          targetMs: target.getTime(),
          diff
        });
      }
    });

    candidates.sort((a, b) => a.targetMs - b.targetMs);
    return candidates[0] || null;
  }

  function tickTimer() {
    const nowMs = Date.now();
    const pill = $("btn-next-timer-pill");
    const headerTxt = $("header-timer-text");
    const display = $("timer-display");
    const targetLabel = $("timer-target-label");
    const resetBtn = $("btn-clear-custom-timer");

    // 1. Custom quick timer takes priority if set
    if (state.customTimer && state.customTimer.endAt) {
      const remaining = state.customTimer.endAt - nowMs;
      resetBtn.classList.remove("hidden");
      if (remaining <= 0) {
        const label = state.customTimer.label || "Meal timer";
        state.customTimer = { endAt: null, label: "" };
        Store.saveState(state);
        notifyUser("Time to eat!", `${label} timer finished`);
        display.textContent = "00:00:00";
        targetLabel.textContent = "Timer finished!";
        pill.classList.add("hidden");
        return;
      }
      const formatted = formatDuration(remaining);
      display.textContent = formatted;
      targetLabel.textContent = state.customTimer.label || "Custom meal countdown";
      headerTxt.textContent = formatted;
      pill.classList.remove("hidden");
      return;
    }

    resetBtn.classList.add("hidden");

    // 2. Otherwise track next scheduled meal today
    const nextMeal = getNextScheduledMealTarget();
    if (!nextMeal) {
      display.textContent = "00:00:00";
      targetLabel.textContent = "No upcoming scheduled meal today";
      pill.classList.add("hidden");
      return;
    }

    const todayStr = Store.toLocalDateStr(new Date());
    if (nextMeal.diff <= 0) {
      const alertKey = `${todayStr}|${nextMeal.slot.id}|${nextMeal.slot.time}`;
      if (!firedAlerts.has(alertKey)) {
        firedAlerts.add(alertKey);
        const mealDesc = nextMeal.slot.name || nextMeal.slot.label || "Scheduled meal";
        notifyUser(`Meal Time (${nextMeal.slot.time})`, mealDesc);
      }
      display.textContent = "00:00:00";
      targetLabel.textContent = `Now: ${nextMeal.slot.name || nextMeal.slot.label} (${nextMeal.slot.time})`;
      headerTxt.textContent = "Now!";
      pill.classList.remove("hidden");
      return;
    }

    const formatted = formatDuration(nextMeal.diff);
    display.textContent = formatted;
    const label = nextMeal.slot.name
      ? `${nextMeal.slot.label}: ${nextMeal.slot.name}`
      : nextMeal.slot.label;
    targetLabel.textContent = `Next (${nextMeal.slot.time}) — ${label}`;
    headerTxt.textContent = formatted;
    pill.classList.remove("hidden");
  }

  function renderScheduleTab() {
    $("toggle-sound").checked = state.settings.sound;
    $("schedule-date-badge").textContent = Store.formatFriendlyDate(selectedDate);

    // Notify button status
    const notifyBtn = $("btn-notify-perm");
    if (!("Notification" in window)) {
      notifyBtn.textContent = "Alerts: Chime only";
      notifyBtn.disabled = true;
    } else if (Notification.permission === "granted") {
      notifyBtn.textContent = "Browser Alerts Enabled";
    } else if (Notification.permission === "denied") {
      notifyBtn.textContent = "Alerts Blocked in Browser";
    } else {
      notifyBtn.textContent = "Enable Browser Alerts";
    }

    // 7-day strip centered around selectedDate (3 days before to 3 days after)
    const strip = $("week-strip");
    strip.innerHTML = "";
    const weightSet = new Set(state.weights.map((w) => w.date));
    const startStr = Store.addDays(selectedDate, -3);
    const endStr = Store.addDays(selectedDate, 3);
    $("week-range-label").textContent = `${startStr.slice(5)} to ${endStr.slice(5)}`;

    for (let i = -3; i <= 3; i += 1) {
      const dStr = Store.addDays(selectedDate, i);
      const dObj = Store.parseLocalDate(dStr);
      const daySlots = state.days[dStr] || [];
      const hasMeals = daySlots.some((s) => Boolean(s.name));
      const hasWt = weightSet.has(dStr);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `week-day-btn${dStr === selectedDate ? " selected" : ""}`;
      btn.innerHTML = `
        <span>${dObj.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span class="day-num">${dObj.getDate()}</span>
        <span class="day-dots">
          ${hasMeals ? '<i class="day-dot-meal" title="Meals planned"></i>' : ""}
          ${hasWt ? '<i class="day-dot-wt" title="Weight logged"></i>' : ""}
        </span>
      `;
      btn.addEventListener("click", () => {
        selectedDate = dStr;
        renderAll();
      });
      strip.appendChild(btn);
    }

    // Timeline for selectedDate
    const slots = Store.ensureDaySlots(state, selectedDate)
      .slice()
      .sort((a, b) => {
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });

    const timeline = $("schedule-timeline");
    timeline.innerHTML = "";

    if (slots.length === 0) {
      timeline.innerHTML = `<div class="card empty-state">No meal slots on this date.</div>`;
      return;
    }

    slots.forEach((slot) => {
      const item = document.createElement("div");
      item.className = "card timeline-item";

      const timeEl = document.createElement("div");
      timeEl.className = "timeline-time";
      timeEl.textContent = slot.time || "--:--";

      const main = document.createElement("div");
      main.className = "timeline-main";
      main.innerHTML = `
        <div class="block-name">${slot.name || `<span style="color:var(--text-muted)">Empty (${slot.label})</span>`}</div>
        <div class="muted-small">${slot.label}${slot.name ? ` · ${Math.round(slot.calories)} kcal · ${slot.protein}g protein` : ""}</div>
      `;

      const statusBtn = document.createElement("button");
      statusBtn.type = "button";
      statusBtn.className = `chip-btn${slot.eaten ? " active" : ""}`;
      statusBtn.textContent = slot.eaten ? "Eaten ✓" : "Mark Eaten";
      statusBtn.addEventListener("click", () => {
        const real = (state.days[selectedDate] || []).find((s) => s.id === slot.id);
        if (real) {
          real.eaten = !real.eaten;
          persistAndRender();
        }
      });

      item.appendChild(timeEl);
      item.appendChild(main);
      item.appendChild(statusBtn);
      timeline.appendChild(item);
    });
  }

  function renderAll() {
    applyTheme();
    renderHeaderMacros();
    renderTodayTab();
    renderMealsTab();
    if (activeTab === "weight") renderWeightTab();
    if (activeTab === "schedule") renderScheduleTab();
    tickTimer();
  }

  // ---------- EVENT WIRING ----------
  function bindEvents() {
    // Bottom nav
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    $("btn-next-timer-pill").addEventListener("click", () => switchTab("schedule"));

    // Close modals
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(backdrop.id);
      });
    });

    // Date bar
    $("btn-prev-day").addEventListener("click", () => {
      selectedDate = Store.addDays(selectedDate, -1);
      renderAll();
    });
    $("btn-next-day").addEventListener("click", () => {
      selectedDate = Store.addDays(selectedDate, 1);
      renderAll();
    });
    $("btn-today-jump").addEventListener("click", () => {
      selectedDate = Store.toLocalDateStr(new Date());
      renderAll();
    });
    $("date-picker").addEventListener("change", (e) => {
      if (e.target.value) {
        selectedDate = e.target.value;
        renderAll();
      }
    });

    // Add slot & day template controls
    $("btn-add-slot").addEventListener("click", () => {
      const slots = Store.ensureDaySlots(state, selectedDate);
      if (slots.length >= 20) {
        showToast("Maximum 20 slots per day reached");
        return;
      }
      slots.push({
        id: Store.uid("slot"),
        label: `Meal ${slots.length + 1}`,
        time: "",
        blockId: null,
        name: "",
        calories: 0,
        protein: 0,
        portion: 1,
        eaten: false
      });
      persistAndRender();
    });

    $("btn-copy-prev").addEventListener("click", () => {
      const prevStr = Store.addDays(selectedDate, -1);
      const prevSlots = state.days[prevStr];
      if (!prevSlots || prevSlots.length === 0) {
        showToast("Yesterday has no saved slots");
        return;
      }
      state.days[selectedDate] = prevSlots.map((s) => ({
        ...s,
        id: Store.uid("slot"),
        eaten: false
      }));
      persistAndRender();
      showToast("Copied yesterday's meals");
    });

    $("btn-save-template").addEventListener("click", () => {
      const slots = Store.ensureDaySlots(state, selectedDate);
      if (slots.length === 0) {
        showToast("Add at least 1 slot first");
        return;
      }
      state.defaultSlots = slots.map((s, idx) => ({
        label: s.label || `Meal ${idx + 1}`,
        time: s.time || ""
      }));
      Store.saveState(state);
      showToast("Saved slot layout as default for new days");
    });

    // Picker modal
    document.querySelectorAll("[data-picker-mode]").forEach((btn) => {
      btn.addEventListener("click", () => setPickerMode(btn.dataset.pickerMode));
    });
    document.querySelectorAll("#picker-portions .chip-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        pickerState.portion = Number(btn.dataset.mult) || 1;
        document.querySelectorAll("#picker-portions .chip-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderPickerList();
      });
    });
    $("picker-search").addEventListener("input", renderPickerList);

    $("picker-custom-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const slots = Store.ensureDaySlots(state, selectedDate);
      const slot = slots.find((s) => s.id === pickerState.slotId);
      if (!slot) return;
      slot.label = $("slot-label-input").value.trim() || slot.label || "Meal";
      slot.name = $("slot-meal-name").value.trim();
      slot.calories = Math.max(0, Number($("slot-meal-cals").value) || 0);
      slot.protein = Math.max(0, Number($("slot-meal-prot").value) || 0);
      slot.time = $("slot-meal-time").value || "";
      slot.portion = 1;
      slot.blockId = null;
      closeModal("modal-picker");
      persistAndRender();
    });

    $("btn-clear-slot").addEventListener("click", () => {
      const slots = Store.ensureDaySlots(state, selectedDate);
      const slot = slots.find((s) => s.id === pickerState.slotId);
      if (!slot) return;
      slot.blockId = null;
      slot.name = "";
      slot.calories = 0;
      slot.protein = 0;
      slot.portion = 1;
      slot.eaten = false;
      closeModal("modal-picker");
      persistAndRender();
    });

    // Meals Library
    $("block-search").addEventListener("input", renderMealsTab);
    $("btn-new-block").addEventListener("click", () => openBlockModal(null));

    $("block-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = $("block-id").value;
      const payload = {
        id: id || Store.uid("blk"),
        name: $("block-name").value.trim(),
        calories: Math.max(0, Math.round(Number($("block-cals").value) || 0)),
        protein: Math.max(0, Math.round((Number($("block-prot").value) || 0) * 10) / 10),
        category: $("block-category").value,
        defaultTime: $("block-time").value || "",
        notes: $("block-notes").value.trim()
      };

      if (id) {
        const idx = state.blocks.findIndex((b) => b.id === id);
        if (idx !== -1) state.blocks[idx] = payload;
        showToast("Updated meal block");
      } else {
        state.blocks.unshift(payload);
        showToast("Saved new meal block");
      }
      closeModal("modal-block");
      persistAndRender();
    });

    $("btn-delete-block").addEventListener("click", () => {
      const id = $("block-id").value;
      if (!id) return;
      state.blocks = state.blocks.filter((b) => b.id !== id);
      closeModal("modal-block");
      persistAndRender();
      showToast("Deleted meal block");
    });

    // Weight Form & Chart Range
    $("weight-date").value = Store.toLocalDateStr(new Date());
    $("weight-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const kgRaw = Number($("weight-input").value);
      const dateStr = $("weight-date").value;
      const note = $("weight-note").value.trim();
      if (!(kgRaw > 0) || !dateStr) return;

      const kg = Math.round(kgRaw * 10) / 10;
      const existing = state.weights.find((w) => w.date === dateStr);
      if (existing) {
        existing.kg = kg;
        existing.note = note;
      } else {
        state.weights.push({ date: dateStr, kg, note });
        state.weights.sort((a, b) => a.date.localeCompare(b.date));
      }
      $("weight-input").value = "";
      $("weight-note").value = "";
      persistAndRender();
      showToast(`Logged ${kg.toFixed(1)} kg for ${dateStr}`);
    });

    document.querySelectorAll("#chart-ranges .range-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        chartRange = btn.dataset.range;
        document.querySelectorAll("#chart-ranges .range-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderWeightTab();
      });
    });

    // Targets Modal
    $("btn-targets").addEventListener("click", () => {
      $("target-calories").value = state.targets.calories;
      $("target-protein").value = state.targets.protein;
      $("target-weight").value = state.targets.goalWeight ?? "";
      openModal("modal-targets");
    });

    $("targets-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.targets.calories = Math.max(200, Math.round(Number($("target-calories").value) || 2200));
      state.targets.protein = Math.max(10, Math.round(Number($("target-protein").value) || 160));
      const gwVal = $("target-weight").value.trim();
      state.targets.goalWeight = gwVal === "" ? null : Math.round(Number(gwVal) * 10) / 10;
      closeModal("modal-targets");
      persistAndRender();
      showToast("Targets updated");
    });

    // Schedule & Timer Controls
    $("toggle-sound").addEventListener("change", (e) => {
      state.settings.sound = e.target.checked;
      Store.saveState(state);
    });

    document.querySelectorAll(".quick-timer-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mins = Number(btn.dataset.mins) || 60;
        state.customTimer = {
          endAt: Date.now() + mins * 60000,
          label: `${mins >= 60 ? `${mins / 60}h` : `${mins}m`} meal timer`
        };
        Store.saveState(state);
        tickTimer();
        showToast(`Started ${state.customTimer.label}`);
      });
    });

    $("btn-clear-custom-timer").addEventListener("click", () => {
      state.customTimer = { endAt: null, label: "" };
      Store.saveState(state);
      tickTimer();
    });

    $("btn-notify-perm").addEventListener("click", async () => {
      if (!("Notification" in window)) return;
      try {
        const perm = await Notification.requestPermission();
        renderScheduleTab();
        showToast(perm === "granted" ? "Browser alerts enabled" : "Browser alerts not granted");
      } catch (_e) {
        showToast("Could not enable alerts");
      }
    });

    // Settings & Backup
    $("btn-settings").addEventListener("click", () => openModal("modal-settings"));
    $("btn-theme-toggle").addEventListener("click", () => {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      persistAndRender();
    });

    $("btn-export-json").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mealblock-backup-${Store.toLocalDateStr(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    });

    $("input-import-json").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          state = Store.sanitizeState(parsed);
          closeModal("modal-settings");
          persistAndRender();
          showToast("Backup restored");
        } catch (_err) {
          showToast("Invalid backup JSON file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    $("btn-restore-samples").addEventListener("click", () => {
      const added = Store.addSampleBlocks(state);
      renderAll();
      showToast(added > 0 ? `Added ${added} sample meal blocks` : "Sample meals already present");
    });

    $("btn-reset-all").addEventListener("click", () => {
      if (!window.confirm("Erase all meals, weight entries, and settings on this device?")) return;
      state = Store.createEmptyState(false);
      closeModal("modal-settings");
      persistAndRender();
      showToast("All data cleared");
    });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  // Boot
  bindEvents();
  renderAll();
  registerServiceWorker();
  setInterval(tickTimer, 1000);
})();
