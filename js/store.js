(function (global) {
  "use strict";

  const STORAGE_KEY = "mealblock_planner_v1";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toLocalDateStr(date) {
    const d = date instanceof Date ? date : new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseLocalDate(dateStr) {
    const parts = String(dateStr || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(dateStr, delta) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + delta);
    return toLocalDateStr(d);
  }

  function formatFriendlyDate(dateStr) {
    const today = toLocalDateStr(new Date());
    if (dateStr === today) return "Today";
    if (dateStr === addDays(today, -1)) return "Yesterday";
    if (dateStr === addDays(today, 1)) return "Tomorrow";
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short"
    });
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  const SAMPLE_BLOCKS = [
    {
      id: "blk_oats",
      name: "Protein Oats & Berries",
      calories: 430,
      protein: 32,
      category: "Breakfast",
      defaultTime: "08:00",
      notes: "60g oats, 1 scoop whey, 80g berries"
    },
    {
      id: "blk_eggs",
      name: "Scrambled Eggs on Toast",
      calories: 460,
      protein: 28,
      category: "Breakfast",
      defaultTime: "08:30",
      notes: "3 eggs, 2 slices sourdough"
    },
    {
      id: "blk_chicken_rice",
      name: "Chicken & Rice Bowl",
      calories: 620,
      protein: 52,
      category: "Lunch",
      defaultTime: "12:30",
      notes: "180g chicken breast, 150g cooked rice, veg"
    },
    {
      id: "blk_tuna_wrap",
      name: "Tuna Salad Wrap",
      calories: 440,
      protein: 38,
      category: "Lunch",
      defaultTime: "13:00",
      notes: "1 tin tuna, high-protein wrap, light mayo"
    },
    {
      id: "blk_yogurt",
      name: "Greek Yogurt & Honey",
      calories: 210,
      protein: 22,
      category: "Snack",
      defaultTime: "16:00",
      notes: "200g 0% Greek yogurt, 10g honey"
    },
    {
      id: "blk_shake",
      name: "Whey Protein Shake",
      calories: 140,
      protein: 26,
      category: "Shake / Drink",
      defaultTime: "16:30",
      notes: "1 scoop whey with water or milk"
    },
    {
      id: "blk_salmon",
      name: "Salmon, Potatoes & Greens",
      calories: 680,
      protein: 46,
      category: "Dinner",
      defaultTime: "19:30",
      notes: "170g salmon fillet, 220g baby potatoes, broccoli"
    },
    {
      id: "blk_beef_pasta",
      name: "Lean Beef Bolognese",
      calories: 650,
      protein: 48,
      category: "Dinner",
      defaultTime: "19:30",
      notes: "160g 5% beef mince, 90g dry pasta, tomato sauce"
    }
  ];

  const DEFAULT_SLOT_TEMPLATE = [
    { label: "Breakfast", time: "08:00" },
    { label: "Lunch", time: "12:30" },
    { label: "Snack", time: "16:00" },
    { label: "Dinner", time: "19:30" }
  ];

  function createEmptyState(withSamples) {
    return {
      version: 1,
      targets: {
        calories: 2200,
        protein: 160,
        goalWeight: null
      },
      settings: {
        theme: "dark",
        sound: true
      },
      blocks: withSamples ? SAMPLE_BLOCKS.map((b) => ({ ...b })) : [],
      defaultSlots: DEFAULT_SLOT_TEMPLATE.map((s) => ({ ...s })),
      days: {},
      weights: [],
      customTimer: {
        endAt: null,
        label: ""
      }
    };
  }

  function sanitizeState(raw) {
    const base = createEmptyState(false);
    if (!raw || typeof raw !== "object") return base;

    if (raw.targets && typeof raw.targets === "object") {
      base.targets.calories = Math.max(200, Number(raw.targets.calories) || 2200);
      base.targets.protein = Math.max(10, Number(raw.targets.protein) || 160);
      const gw = raw.targets.goalWeight;
      base.targets.goalWeight =
        gw === null || gw === "" || Number.isNaN(Number(gw)) ? null : Number(gw);
    }

    if (raw.settings && typeof raw.settings === "object") {
      base.settings.theme = raw.settings.theme === "light" ? "light" : "dark";
      base.settings.sound = raw.settings.sound !== false;
    }

    if (Array.isArray(raw.blocks)) {
      base.blocks = raw.blocks
        .filter((b) => b && typeof b.name === "string")
        .map((b) => ({
          id: b.id || uid("blk"),
          name: b.name.trim(),
          calories: Math.max(0, Number(b.calories) || 0),
          protein: Math.max(0, Number(b.protein) || 0),
          category: b.category || "Lunch",
          defaultTime: b.defaultTime || "",
          notes: b.notes || ""
        }));
    }

    if (Array.isArray(raw.defaultSlots) && raw.defaultSlots.length > 0) {
      base.defaultSlots = raw.defaultSlots.map((s, idx) => ({
        label: (s && s.label) || `Meal ${idx + 1}`,
        time: (s && s.time) || ""
      }));
    }

    if (raw.days && typeof raw.days === "object") {
      Object.keys(raw.days).forEach((dateKey) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Array.isArray(raw.days[dateKey])) {
          base.days[dateKey] = raw.days[dateKey].map((slot, idx) => ({
            id: (slot && slot.id) || uid("slot"),
            label: (slot && slot.label) || `Meal ${idx + 1}`,
            time: (slot && slot.time) || "",
            blockId: (slot && slot.blockId) || null,
            name: (slot && slot.name) || "",
            calories: Math.max(0, Number(slot && slot.calories) || 0),
            protein: Math.max(0, Number(slot && slot.protein) || 0),
            portion: Number(slot && slot.portion) > 0 ? Number(slot.portion) : 1,
            eaten: Boolean(slot && slot.eaten)
          }));
        }
      });
    }

    if (Array.isArray(raw.weights)) {
      const byDate = new Map();
      raw.weights.forEach((w) => {
        if (w && /^\d{4}-\d{2}-\d{2}$/.test(w.date) && Number(w.kg) > 0) {
          byDate.set(w.date, {
            date: w.date,
            kg: Math.round(Number(w.kg) * 10) / 10,
            note: typeof w.note === "string" ? w.note : ""
          });
        }
      });
      base.weights = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    if (raw.customTimer && typeof raw.customTimer === "object") {
      base.customTimer = {
        endAt: typeof raw.customTimer.endAt === "number" ? raw.customTimer.endAt : null,
        label: typeof raw.customTimer.label === "string" ? raw.customTimer.label : ""
      };
    }

    return base;
  }

  function loadState() {
    try {
      const rawText = localStorage.getItem(STORAGE_KEY);
      if (!rawText) {
        const fresh = createEmptyState(true);
        saveState(fresh);
        return fresh;
      }
      return sanitizeState(JSON.parse(rawText));
    } catch (_err) {
      return createEmptyState(true);
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function buildSlotsFromDefault(state) {
    return state.defaultSlots.map((tpl, idx) => ({
      id: uid("slot"),
      label: tpl.label || `Meal ${idx + 1}`,
      time: tpl.time || "",
      blockId: null,
      name: "",
      calories: 0,
      protein: 0,
      portion: 1,
      eaten: false
    }));
  }

  function ensureDaySlots(state, dateStr) {
    if (!state.days[dateStr]) {
      state.days[dateStr] = buildSlotsFromDefault(state);
      saveState(state);
    }
    return state.days[dateStr];
  }

  function addSampleBlocks(state) {
    const existingNames = new Set(state.blocks.map((b) => b.name.toLowerCase()));
    let added = 0;
    SAMPLE_BLOCKS.forEach((sample) => {
      if (!existingNames.has(sample.name.toLowerCase())) {
        state.blocks.push({ ...sample, id: uid("blk") });
        added += 1;
      }
    });
    saveState(state);
    return added;
  }

  global.MealStore = {
    toLocalDateStr,
    parseLocalDate,
    addDays,
    formatFriendlyDate,
    uid,
    loadState,
    saveState,
    createEmptyState,
    sanitizeState,
    ensureDaySlots,
    addSampleBlocks
  };
})(window);
