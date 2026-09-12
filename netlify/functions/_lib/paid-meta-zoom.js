const ZOOM_BOOKING_URL = 'https://plantbased-balance.org/book';
const ZOOM_RE = /\bzoom\b|\blive (?:one[- ]on[- ]one |1[:.]1 )?(?:training|workouts?|sessions?)\b/i;

function buildPaidMetaZoomHandoff({ currentMessage = '', history = [], flowVariant } = {}) {
    if (flowVariant !== 'broad_pain') return null;
    const text = String(currentMessage).trim();
    // Work meetings are context, not a request to buy live workouts.
    if (/\b(?:work|meetings?|calls?)\b.*\bzoom\b|\bzoom\b.*\b(?:work|meetings?|all day)\b/i.test(text)
        && !/\b(?:want|interested in|book|try)\b[^.!?]{0,35}\b(?:zoom (?:training|pt|sessions?)|live (?:training|sessions?))\b/i.test(text)) return null;
    // Price comparisons need the writer to answer what the quoted price buys.
    if (/\b149\b/.test(text)) return null;
    if (/\b(?:hold off|not now|stop messaging|leave me|no thanks|not interested)\b/i.test(text)
        || /\b(?:no|not|without|don['’]?t want|do not want)\s+(?:the\s+)?(?:zoom|live training|live sessions)\b/i.test(text)
        || /\b(?:just|only) (?:the )?(?:course|learn|app|preview)\b/i.test(text)) return null;
    const recentOut = [...history].reverse().filter(x => x?.direction === 'out').slice(0,2);
    const lastOut = recentOut[0];
    const priorZoom = ZOOM_RE.test(String(lastOut?.text || ''))
        || (/\bfit call\b/i.test(String(lastOut?.text || '')) && ZOOM_RE.test(String(recentOut[1]?.text || '')));
    const explicit = ZOOM_RE.test(text);
    const acceptance = /^(?:yes|yeah|yep|sure|okay|ok|sounds good|keen|please|let['’]?s do it)\b/i.test(text);
    const priceQuestion = /\b(?:price|cost|how much|per week|weekly|include[ds]?|course included|30.minute|half.hour)\b/i.test(text);
    const bookingRequest = /\b(?:book|call|availability|sign up|join|pay|send.*link)\b/i.test(text);
    if (!explicit && !(priorZoom && (acceptance || priceQuestion || bookingRequest))) return null;
    // Unknown compound questions need the writer's real answer, not a
    // transport shortcut that could erase their question.
    if (/\?/.test(text) && /\b(?:injur|pain|hurt|pregnan|refund|cancel|time zone|weekends?|evenings?|equipment|recorded|recording)\w*\b/i.test(text)) return null;
    const interested = /\b(?:want|interested|keen|prefer|like|yes|can i|could i|tell me|how does|how do)\b/i.test(text);
    if (!priceQuestion && !bookingRequest && !acceptance && !interested) return null;
    const frequency = /\b(?:three|3)\s*(?:zoom\s+)?(?:times|sessions?)?\s*(?:a|per|each)?\s*week|\bzoom pt\s*3\b/i.test(text) ? 3
        : /\b(?:five|5)\s*(?:zoom\s+)?(?:times|sessions?)?\s*(?:a|per|each)?\s*week|\bzoom pt\s*5\b/i.test(text) ? 5
        : /\b(?:one|1|once)\s*(?:zoom\s+)?(?:times|sessions?)?\s*(?:a|per|each)?\s*week|\bzoom pt\s*1\b/i.test(text) ? 1 : null;
    const prices = {1:125,3:275,5:425};
    const facts = priceQuestion || frequency
        ? (frequency ? `The ${frequency}-session option is AUD $${prices[frequency]} per week.` : 'The options are AUD $125/week for one session, $275/week for three, or $425/week for five.')
        : '';
    const joined = `Zoom PT includes Balance Learn plus live 30-minute one-on-one training sessions with me.${facts ? ' '+facts : ''} It starts with a six-week coaching block.\n\nBook a fit call here so we can check availability and whether it suits you before payment: ${ZOOM_BOOKING_URL}`;
    return {joined,chunks:joined.split('\n\n'),model:'deterministic_paid_meta_guided_sales_v1',replyMode:'campaign_sales_progression',paidMetaZoomHandoff:true,callBookingUrl:ZOOM_BOOKING_URL,maxChunks:2,flowVariant,error:null};
}
module.exports={buildPaidMetaZoomHandoff,ZOOM_BOOKING_URL};
