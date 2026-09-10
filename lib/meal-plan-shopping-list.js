(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BalanceMealPlanShopping = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function keyFor(name) {
    return clean(name).toLocaleLowerCase('en-AU');
  }

  // Only remove preparation instructions, never dietary or product qualifiers.
  function shoppingName(name) {
    const prep = /^(?:(?:finely|roughly|thinly|freshly)\s+)?(?:chopped|diced|sliced|peeled|grated|julienned|quartered|halved|deseeded|seeded|minced|rinsed|washed|trimmed)(?:\s+and\s+(?:chopped|diced|sliced|peeled|deseeded|rinsed|washed|trimmed))*$/i;
    const parts = clean(name).split(/,\s*/);
    let base = parts.shift();
    const qualifiers = parts.filter(part => !prep.test(part));
    base = base.replace(/^(?:(?:finely|roughly|thinly)\s+)?(?:chopped|diced|sliced|peeled|grated|julienned)\s+/i, '');
    // Fresh/frozen berries are interchangeable in these plans; dried berries are not.
    const berry = /^(?:fresh\s+|frozen\s+)?(strawberries|blueberries|raspberries|blackberries)$/i.exec(base);
    if (berry && qualifiers.every(part => /^(fresh|frozen)$/i.test(part))) return berry[1];
    return [base].concat(qualifiers).join(', ');
  }

  function quantity(amount) {
    const fractions = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
    const value = clean(amount).replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g, '$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g, ch => fractions[ch]);
    const match = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+)\s*([a-zA-Z]*)$/.exec(value);
    if (!match) return null;
    const number = match[1].split(/\s+/).reduce((total, term) => {
      const pair = term.split('/');
      return total + (pair.length === 2 ? Number(pair[0]) / Number(pair[1]) : Number(term));
    }, 0);
    if (!Number.isFinite(number) || number < 0) return null;
    const units = {
      g: ['g', 1], gram: ['g', 1], grams: ['g', 1], kg: ['g', 1000], kilogram: ['g', 1000], kilograms: ['g', 1000],
      ml: ['ml', 1], millilitre: ['ml', 1], millilitres: ['ml', 1], milliliter: ['ml', 1], milliliters: ['ml', 1], l: ['ml', 1000], litre: ['ml', 1000], litres: ['ml', 1000], liter: ['ml', 1000], liters: ['ml', 1000],
      tsp: ['tsp', 1], teaspoon: ['tsp', 1], teaspoons: ['tsp', 1], tbsp: ['tbsp', 1], tablespoon: ['tbsp', 1], tablespoons: ['tbsp', 1],
      cup: ['cup', 1], cups: ['cup', 1], pinch: ['pinch', 1], pinches: ['pinch', 1],
      '': ['', 1], small: ['small', 1], medium: ['medium', 1], large: ['large', 1], clove: ['clove', 1], cloves: ['clove', 1], piece: ['piece', 1], pieces: ['piece', 1]
    };
    const unit = units[match[2].toLowerCase()];
    return unit ? { unit: unit[0], value: number * unit[1] } : null;
  }

  function numberText(value, fractions) {
    if (fractions) {
      const whole = Math.floor(value + 1e-9);
      for (const denominator of [2, 3, 4, 8]) {
        const numerator = Math.round((value - whole) * denominator);
        if (numerator > 0 && numerator < denominator && Math.abs(value - whole - numerator / denominator) < 1e-6) return (whole ? whole + ' ' : '') + numerator + '/' + denominator;
      }
    }
    return String(Math.round(value * 10000) / 10000);
  }

  function readIngredient(raw) {
    if (typeof raw === 'string') {
      return { name: clean(raw), amount: '' };
    }

    if (!raw || typeof raw !== 'object') return { name: '', amount: '' };
    let amount = Number.isFinite(raw.grams) && raw.grams > 0 ? raw.grams + ' g' : clean(raw.amount ?? raw.quantity ?? raw.qty);
    if (raw.unit && /^\d+(?:\.\d+)?$/.test(amount)) amount += ' ' + clean(raw.unit);
    return {
      name: clean(raw.name || raw.ingredient || raw.item),
      amount: amount
    };
  }

  function formatAmounts(amountCounts, unmeasuredCount) {
    const parts = [];
    const totals = new Map();
    amountCounts.forEach(function (count, amount) {
      const parsed = quantity(amount);
      if (parsed) totals.set(parsed.unit, (totals.get(parsed.unit) || 0) + parsed.value * count);
      else parts.push(count > 1 ? count + ' × (' + amount + ')' : amount);
    });
    totals.forEach(function (total, unit) {
      let displayUnit = unit;
      if (unit === 'g' && total >= 1000) { total /= 1000; displayUnit = 'kg'; }
      if (unit === 'ml' && total >= 1000) { total /= 1000; displayUnit = 'L'; }
      if (total !== 1 && ['cup', 'clove', 'piece'].includes(unit)) displayUnit += 's';
      if (total !== 1 && unit === 'pinch') displayUnit = 'pinches';
      parts.unshift(numberText(total, !['g', 'kg', 'ml', 'L'].includes(displayUnit)) + (displayUnit ? ' ' + displayUnit : ''));
    });
    if (unmeasuredCount) parts.push(parts.length ? 'extra as needed' : 'as needed');
    return parts.join(' + ');
  }

  function buildWeekItems(week) {
    const grouped = new Map();
    const days = Array.isArray(week && week.days) ? week.days : [];

    days.forEach(function (day) {
      const meals = Array.isArray(day && day.meals) ? day.meals : [];
      meals.forEach(function (meal) {
        const ingredients = Array.isArray(meal && meal.ingredients) ? meal.ingredients : [];
        ingredients.forEach(function (raw) {
          const parsed = readIngredient(raw);
          if (!parsed.name) return;

          // Measured recipes specify edible weights; retain peeled/drained/cooked state.
          const name = raw && raw.food_id ? parsed.name : shoppingName(parsed.name);
          const key = keyFor(name);
          if (!grouped.has(key)) {
            grouped.set(key, {
              key: key,
              name: name,
              amountCounts: new Map(),
              unmeasuredCount: 0
            });
          }

          const item = grouped.get(key);
          if (parsed.amount) {
            item.amountCounts.set(parsed.amount, (item.amountCounts.get(parsed.amount) || 0) + 1);
          } else {
            item.unmeasuredCount += 1;
          }
        });
      });
    });

    return Array.from(grouped.values())
      .map(function (item) {
        return {
          key: item.key,
          name: item.name,
          amount: formatAmounts(item.amountCounts, item.unmeasuredCount)
        };
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, 'en-AU', { sensitivity: 'base' });
      });
  }

  function toText(options) {
    const settings = options || {};
    const items = Array.isArray(settings.items) ? settings.items : [];
    const checked = settings.checked instanceof Set ? settings.checked : new Set(settings.checked || []);
    const planName = clean(settings.planName) || 'Your meal plan';
    const weekNumber = Number(settings.weekNumber) || 1;
    const lines = [
      'BALANCE SHOPPING LIST',
      planName + ' | Week ' + weekNumber,
      ''
    ];

    items.forEach(function (item) {
      const amount = clean(item.amount);
      lines.push((checked.has(item.key) ? '[x] ' : '[ ] ') + item.name + (amount ? ' - ' + amount : ''));
    });

    return lines.join('\n') + '\n';
  }

  return {
    buildWeekItems: buildWeekItems,
    toText: toText
  };
});
