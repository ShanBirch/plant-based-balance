(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.BalanceFamilyServings = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    function portions(value) {
        const number = Number(value);
        return Number.isInteger(number) && number >= 2 && number <= 10 ? number : 5;
    }
    function supported(meal) {
        return !!meal?.ingredients?.length && meal.ingredients.every(item =>
            item && Number.isFinite(item.personal_quantity) && item.personal_quantity >= 0 &&
            Number.isFinite(item.other_quantity) && item.other_quantity >= 0 && typeof item.unit === 'string');
    }
    function amount(item, mode, count) {
        const number = mode === 'family'
            ? item.personal_quantity + item.other_quantity * (portions(count) - 1)
            : item.personal_quantity;
        return Number(number.toFixed(2)) + (item.unit ? ' ' + item.unit : '');
    }
    function ingredients(meal, mode, count) {
        if (!supported(meal)) return meal?.ingredients || [];
        return meal.ingredients.filter(item => mode === 'family' || item.personal_quantity > 0)
            .map(item => ({ ...item, amount: amount(item, mode, count) }));
    }
    function practicalAmount(item, mode, count) {
        const qty = mode === 'family' ? item.personal_quantity + item.other_quantity * (portions(count) - 1) : item.personal_quantity;
        const name = item.name.toLowerCase();
        const rounded = n => Number(n.toFixed(1));
        if (!item.unit || /slice/.test(item.unit)) return amount(item, mode, count);
        if (item.unit === 'ml') return `About ${rounded(qty / 250)} cup${qty > 250 ? 's' : ''}`;
        if (/rice|quinoa/.test(name)) return `About ${rounded(qty / 60)} cupped hand${qty > 60 ? 's' : ''} cooked`;
        if (/chicken|beef/.test(name)) return `About ${rounded(qty / 150)} palm-sized portion${qty > 150 ? 's' : ''} cooked`;
        if (/oil|peanut butter|yoghurt|milk|juice|seed|cheese|cumin|paprika|oregano|parsley|dill/.test(name)) {
            const unit = /yoghurt|milk/.test(name) ? 'cup' : /cheese|seed/.test(name) ? 'tablespoon' : 'teaspoon';
            const base = unit === 'cup' ? (/milk/.test(name) ? 250 : 240) : unit === 'tablespoon' ? 10 : /butter/.test(name) ? 5 : /cumin|paprika|oregano|parsley|dill/.test(name) ? 2 : 5;
            return `About ${rounded(qty / base)} ${unit}${qty > base ? 's' : ''}`;
        }
        if (/banana/.test(name)) return `About ${rounded(qty / 100)} small banana${qty > 100 ? 's' : ''}`;
        return `About ${rounded(qty / (/lettuce|spinach/.test(name) ? 35 : 100))} ${/lettuce|spinach/.test(name) ? 'loose handful' : 'fist-sized portion'}${qty > (/lettuce|spinach/.test(name) ? 35 : 100) ? 's' : ''}`;
    }
    function render(meal, count) {
        if (!supported(meal)) return '';
        count = portions(count);
        return `<section class="ai-plan-family" aria-label="Recipe servings">
            <div class="ai-plan-family__heading"><h4>One meal, shared</h4><label>Batch portions
                <select onchange="setAiPlanFamilyPortions(this.value)" aria-label="Family batch portions">
                ${Array.from({ length: 9 }, (_, i) => i + 2).map(n => `<option value="${n}"${n === count ? ' selected' : ''}>${n}</option>`).join('')}
                </select></label></div>
            <label>Portion guide <select aria-label="Portion guide" onchange="setAiPlanPortionGuide(this.value)"><option value="grams"${rootMode() !== 'hands' ? ' selected' : ''}>Grams & measures</option><option value="hands"${rootMode() === 'hands' ? ' selected' : ''}>Hands & household measures</option></select></label>
            <p>${rootMode() === 'hands' ? 'Use your own hand: a palm for cooked protein, a cupped hand for cooked rice, and a fist or loose handful for produce. Spoon and cup measures suit liquids and small ingredients. These are rough visual guides, not exact weight equivalents.' : escape(meal.portion_note || meal.description || 'Your column is one starting portion. The batch includes it; serve the remaining food to appetite.')}</p>
            <table><thead><tr><th scope="col">Ingredient</th><th scope="col">Your serving</th><th scope="col">Batch (${count})</th></tr></thead><tbody>
            ${meal.ingredients.map(item => `<tr><th scope="row">${escape(rootMode() === 'hands' ? item.name.replace(' (raw)', ' (cooked)').replace(' (dry)', ' (cooked)') : item.name)}</th><td>${item.personal_quantity ? escape((rootMode() === 'hands' ? practicalAmount : amount)(item, 'personal', count)) : 'Optional'}</td><td>${escape((rootMode() === 'hands' ? practicalAmount : amount)(item, 'family', count))}</td></tr>`).join('')}
            </tbody></table>
            <p class="ai-plan-family__footnote">${rootMode() === 'hands' ? 'Visual portions vary with hand size, food shape and cooking. Shopping and recipe preparation still use the measured quantities. ' : 'Meat weights are raw; tinned tuna is drained. Grain weights are dry unless marked cooked. '}Batch portions are cooking quantities, not fixed child servings.</p>
        </section>`;
    }
    function rootMode() { return typeof window !== 'undefined' ? window._aiPlanPortionGuide : 'grams'; }
    return { portions, supported, amount, ingredients, practicalAmount, render };
});
