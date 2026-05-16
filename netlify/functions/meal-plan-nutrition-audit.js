/**
 * Meal Plan Nutrition Audit
 *
 * Daily safety net for active coaching clients with active AI meal plans.
 * It raises an internal `nutrition_gap` coach alert when plan rows are missing,
 * calories drift from targets, or stored calories/macros no longer agree.
 */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const CURATED_PLAN_NAME = '30-Day Plant-Based Meal Plan';
const AUDIT_VERSION = '2026-05-16-meal-plan-nutrition-audit';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

async function supabaseQuery(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : [];
}

function chunk(values, size = 80) {
    const out = [];
    for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
    return out;
}

function inList(values) {
    return `(${values.map(value => String(value).replace(/[()]/g, '')).join(',')})`;
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function macroCalories(meal) {
    const p = numberOrNull(meal.protein_g) || 0;
    const c = numberOrNull(meal.carbs_g) || 0;
    const f = numberOrNull(meal.fat_g) || 0;
    return Math.round((p * 4) + (c * 4) + (f * 9));
}

function latestQuizByUser(rows) {
    const byUser = new Map();
    for (const row of rows || []) {
        const userId = row.user_id;
        if (!userId) continue;
        const existing = byUser.get(userId);
        if (!existing || String(row.created_at || '') > String(existing.created_at || '')) byUser.set(userId, row);
    }
    return byUser;
}

function issue(severity, code, message, data = {}) {
    return { severity, code, message, ...data };
}

function dayGroups(meals) {
    const groups = new Map();
    for (const meal of meals) {
        const key = `${meal.week_number || 0}:${meal.day_of_week ?? 'x'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(meal);
    }
    return groups;
}

function auditPlan(plan, meals, quiz) {
    const issues = [];
    const targetCalories = numberOrNull(plan.calorie_goal) || numberOrNull(quiz?.calorie_goal);
    const proteinTarget = numberOrNull(plan.protein_goal_g) || numberOrNull(quiz?.protein_goal_g);
    const days = dayGroups(meals);
    const dayTotals = [...days.values()].map(dayMeals => ({
        calories: dayMeals.reduce((sum, meal) => sum + (numberOrNull(meal.calories) || 0), 0),
        protein: dayMeals.reduce((sum, meal) => sum + (numberOrNull(meal.protein_g) || 0), 0),
        mealCount: dayMeals.length,
    }));

    if (!meals.length) {
        issues.push(issue('high', 'missing_meals', 'Active meal plan has no meal rows.'));
        return issues;
    }

    if (plan.plan_name === CURATED_PLAN_NAME) {
        if (meals.length !== 140) {
            issues.push(issue('high', 'wrong_meal_count', `Expected 140 meals, found ${meals.length}.`, { found: meals.length }));
        }
        if (days.size !== 28) {
            issues.push(issue('high', 'wrong_day_count', `Expected 28 plan days, found ${days.size}.`, { found: days.size }));
        }
    }

    if (!numberOrNull(plan.calorie_goal) && numberOrNull(quiz?.calorie_goal)) {
        issues.push(issue('medium', 'missing_plan_target', `Plan is missing stored calorie target; latest quiz target is ${quiz.calorie_goal}.`));
    }

    if (targetCalories && dayTotals.length) {
        const tolerance = Math.max(50, targetCalories * 0.05);
        const offDays = dayTotals.filter(day => Math.abs(day.calories - targetCalories) > tolerance);
        if (offDays.length) {
            const sample = offDays.slice(0, 3).map(day => Math.round(day.calories)).join(', ');
            issues.push(issue('high', 'day_calorie_drift', `${offDays.length} day(s) are outside target tolerance ${Math.round(targetCalories)} cal. Sample totals: ${sample}.`, {
                target_calories: targetCalories,
                off_days: offDays.length,
            }));
        }
    }

    const macroMismatches = meals
        .map(meal => {
            const stored = numberOrNull(meal.calories);
            const calculated = macroCalories(meal);
            const diff = stored == null ? 0 : Math.abs(stored - calculated);
            const tolerance = stored == null ? 0 : Math.max(50, stored * 0.18);
            return stored != null && calculated > 0 && diff > tolerance
                ? `${meal.name || 'Meal'} ${stored}cal vs ${calculated}cal from macros`
                : null;
        })
        .filter(Boolean);
    if (macroMismatches.length) {
        issues.push(issue('high', 'meal_macro_mismatch', `${macroMismatches.length} meal row(s) have calories that do not match macros.`, {
            examples: macroMismatches.slice(0, 3),
        }));
    }

    if (proteinTarget && dayTotals.length) {
        const avgProtein = dayTotals.reduce((sum, day) => sum + day.protein, 0) / dayTotals.length;
        if (avgProtein < proteinTarget * 0.8) {
            issues.push(issue('medium', 'protein_target_gap', `Average plan protein is ${Math.round(avgProtein)}g/day vs ${Math.round(proteinTarget)}g target.`, {
                target_protein_g: proteinTarget,
                average_protein_g: Math.round(avgProtein),
            }));
        }
    }

    return issues;
}

function issueSignature(planId, issues) {
    const text = JSON.stringify(issues.map(item => [item.code, item.message]).sort());
    return crypto.createHash('sha1').update(`${planId}:${text}`).digest('hex').slice(0, 16);
}

async function upsertAuditAlert({ client, user, plan, issues }) {
    if (!client?.coach_id || !plan?.user_id || !issues.length) return { inserted: false, reason: 'missing-alert-data' };
    const signature = issueSignature(plan.id, issues);
    const idempotencyKey = `meal-plan-nutrition-audit:${plan.id}:${signature}`;
    const existing = await supabaseQuery(
        `coach_alerts?select=id,status&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    ).catch(() => []);
    if (existing?.[0]?.id) return { inserted: false, deduped: true, alertId: existing[0].id };

    const clientName = user?.name || user?.full_name || user?.email || 'Client';
    const highCount = issues.filter(item => item.severity === 'high').length;
    const title = `Meal plan nutrition check: ${clientName}`;
    const description = issues.map(item => item.message).join(' ');
    const row = {
        coach_id: client.coach_id,
        client_id: plan.user_id,
        client_name: clientName,
        alert_type: 'nutrition_gap',
        priority: highCount ? 'high' : 'medium',
        status: 'pending',
        title,
        description,
        suggested_message: '',
        idempotency_key: idempotencyKey,
        data: {
            subtype: 'meal_plan_nutrition_audit',
            audit_version: AUDIT_VERSION,
            plan_id: plan.id,
            plan_name: plan.plan_name,
            issues,
        },
    };
    const inserted = await supabaseQuery('coach_alerts', {
        method: 'POST',
        body: [row],
        prefer: 'return=representation',
    });
    return { inserted: true, alertId: inserted?.[0]?.id || null };
}

async function loadRowsForActiveClients() {
    const clients = await supabaseQuery('coach_clients?select=client_id,coach_id,status&status=eq.active&limit=1000');
    const userIds = [...new Set(clients.map(client => client.client_id).filter(Boolean))];
    if (!userIds.length) return { clients, users: [], plans: [], meals: [], quizzes: [] };

    const users = [];
    const plans = [];
    const meals = [];
    const quizzes = [];

    for (const ids of chunk(userIds)) {
        users.push(...await supabaseQuery(`users?select=id,name,full_name,email&id=in.${inList(ids)}&limit=1000`).catch(() => []));
        quizzes.push(...await supabaseQuery(`quiz_results?select=user_id,calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g,created_at&user_id=in.${inList(ids)}&order=created_at.desc&limit=1000`).catch(() => []));
        plans.push(...await supabaseQuery(`ai_generated_meal_plans?select=id,user_id,plan_name,status,calorie_goal,protein_goal_g,carbs_goal_g,fat_goal_g,created_at&status=eq.active&user_id=in.${inList(ids)}&limit=1000`).catch(() => []));
    }

    const planIds = [...new Set(plans.map(plan => plan.id).filter(Boolean))];
    for (const ids of chunk(planIds, 40)) {
        meals.push(...await supabaseQuery(`ai_generated_meals?select=id,plan_id,name,calories,protein_g,carbs_g,fat_g,fiber_g,week_number,day_of_week,meal_slot&plan_id=in.${inList(ids)}&limit=5000`).catch(() => []));
    }

    return { clients, users, plans, meals, quizzes };
}

exports.handler = async function handler(event = {}) {
    try {
        const params = event.queryStringParameters || {};
        const dryRun = params.dryRun === 'true' || params.dry_run === 'true';
        const { clients, users, plans, meals, quizzes } = await loadRowsForActiveClients();
        const clientsByUser = new Map(clients.map(client => [client.client_id, client]));
        const usersById = new Map(users.map(user => [user.id, user]));
        const quizzesByUser = latestQuizByUser(quizzes);
        const mealsByPlan = new Map();
        for (const meal of meals) {
            if (!mealsByPlan.has(meal.plan_id)) mealsByPlan.set(meal.plan_id, []);
            mealsByPlan.get(meal.plan_id).push(meal);
        }

        const audited = [];
        const alerts = [];
        for (const plan of plans) {
            const client = clientsByUser.get(plan.user_id);
            const issues = auditPlan(plan, mealsByPlan.get(plan.id) || [], quizzesByUser.get(plan.user_id));
            audited.push({
                plan_id: plan.id,
                user_id: plan.user_id,
                issue_count: issues.length,
                issue_codes: issues.map(item => item.code),
            });
            if (issues.length && !dryRun) {
                alerts.push(await upsertAuditAlert({
                    client,
                    user: usersById.get(plan.user_id),
                    plan,
                    issues,
                }));
            }
        }

        return json(200, {
            success: true,
            active_clients: clients.length,
            active_plans: plans.length,
            plans_with_issues: audited.filter(item => item.issue_count > 0).length,
            dry_run: dryRun,
            alerts_inserted: alerts.filter(item => item.inserted).length,
            alerts_deduped: alerts.filter(item => item.deduped).length,
            audited,
        });
    } catch (error) {
        console.error('[meal-plan-nutrition-audit]', error);
        return json(500, { success: false, error: error.message });
    }
};
