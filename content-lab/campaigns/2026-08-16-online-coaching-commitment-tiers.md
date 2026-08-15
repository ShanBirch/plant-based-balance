# Online Coaching Commitment Tiers

- Launch date: 2026-08-16
- Variant: `online_coaching_commitment_tiers_v1`
- Destination: `https://plantbased-balance.org/coaching.html#plan-checkout`
- Eligible traffic: all new website Online Coaching buyers; existing subscriptions keep their agreed price and terms
- Offer: the same Balance Online Coaching at AU$29.99/week with a 26-week initial minimum, AU$49.99/week with a 13-week initial minimum, or AU$74.99/week with a four-week initial minimum. Each is billed weekly and continues at the selected rate after the initial term until cancelled.
- Hypothesis: clearly rewarding a longer coaching commitment will increase total contracted coaching revenue and six-month selections without reducing qualified Online Coaching purchases below a sustainable level.
- Primary KPI: new Online Coaching contracted value, measured as the initial minimum value of each paid Stripe subscription.
- Diagnostic metrics: coaching-page visits, checkout attempts by tier, checkout starts by tier, paid subscriptions by tier, checkout completion rate, six-month selection rate, three-month selection rate, month-to-month selection rate, and time from first qualified DM to purchase.
- Guardrails: charge and initial minimum must be visible before checkout; the exact selected tier must be preserved in Stripe and the user subscription record; existing clients are not repriced; refund, cancellation and Australian Consumer Law requests remain reviewable; support load and payment-failure rate must not materially increase.
- Decision date: 2026-09-13, or after 20 qualified Online Coaching checkout starts if later.
- Keep/stop rule: keep the structure if contracted value rises without a material fall in paid coaching starts or an increase in pricing complaints. Revisit the AU$49.99 middle tier first if buyers disproportionately abandon after selecting three months.

Initial minimum values:

- Six months: 26 x AU$29.99 = AU$779.74
- Three months: 13 x AU$49.99 = AU$649.87
- Month-to-month: 4 x AU$74.99 = AU$299.96
