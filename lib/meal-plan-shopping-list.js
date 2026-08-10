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

  function readIngredient(raw) {
    if (typeof raw === 'string') {
      return { name: clean(raw), amount: '' };
    }

    if (!raw || typeof raw !== 'object') return { name: '', amount: '' };
    return {
      name: clean(raw.name || raw.ingredient || raw.item),
      amount: clean(raw.amount || raw.quantity || raw.qty)
    };
  }

  function formatAmounts(amountCounts, unmeasuredCount) {
    const parts = [];
    amountCounts.forEach(function (count, amount) {
      parts.push(count > 1 ? amount + ' x ' + count : amount);
    });
    if (unmeasuredCount > 1) parts.push('needed in ' + unmeasuredCount + ' meals');
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

          const key = keyFor(parsed.name);
          if (!grouped.has(key)) {
            grouped.set(key, {
              key: key,
              name: parsed.name,
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
