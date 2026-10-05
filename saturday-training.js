(() => {
    const el = id => document.getElementById(id);
    const API = '/api/group-session';
    let reserve = false;
    const notice = message => { el('notice').textContent = message; el('notice').hidden = !message; };
    async function request(options = {}, suffix = '') {
        const response = await fetch(API + suffix, { ...options, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'unavailable');
        return data;
    }
    async function availability() {
        el('retry').hidden = true; el('form').hidden = true; notice('');
        try {
            const data = await request();
            reserve = data.remaining === 0;
            el('count').textContent = data.closed ? 'Bookings are now closed.' : reserve ? 'Fully booked · Reserve list open' : `${data.remaining} of ${data.capacity} spots available`;
            el('spots').replaceChildren(...Array.from({ length: data.capacity }, (_, i) => {
                const item = document.createElement('span'); item.className = 'spot' + (i < data.booked ? ' taken' : '');
                item.textContent = i < data.booked ? '✓' : String(i + 1); item.setAttribute('aria-label', `Spot ${i + 1}: ${i < data.booked ? 'booked' : 'available'}`); return item;
            }));
            el('booking-title').textContent = reserve ? 'Join the reserve list' : 'Book your free spot';
            el('submit').textContent = reserve ? 'Join the reserve list' : 'Book my free spot';
            el('reserve-info').hidden = !reserve || data.closed;
            el('form').hidden = data.closed;
        } catch { el('count').textContent = 'Availability is temporarily unavailable.'; notice('Please try again, or text Shannon on 0478 209 395.'); el('retry').hidden = false; }
    }
    function receipt(data, token) {
        el('booking').hidden = true; el('receipt').hidden = false;
        const confirmed = data.status === 'confirmed';
        el('receipt-title').textContent = confirmed ? 'You’re booked in!' : data.status === 'reserve' ? 'You’re on the reserve list.' : 'Your booking has been cancelled.';
        el('receipt-copy').textContent = confirmed ? 'See you Saturday 10 October, 9–10 a.m. Brisbane time (10–11 a.m. Melbourne/Sydney). Your free spot is confirmed.' : data.status === 'reserve' ? 'This is a reserve place, not a confirmed booking. Shannon will contact you if a spot becomes available.' : 'Contact Shannon if you’d like to rebook.';
        el('join').hidden = !confirmed; if (confirmed) el('join').href = data.meetingUrl;
        el('email-status').textContent = data.emailSent ? 'A confirmation has been sent to your email. Check your junk folder too.' : 'Please save this page for your booking details. If you need a hand, text Shannon on 0478 209 395.';
        el('save').href = '#' + token; history.replaceState(null, '', '#' + token); el('receipt').focus();
    }
    el('form').addEventListener('submit', async event => {
        event.preventDefault(); notice(''); el('submit').disabled = true;
        const address = el('email').value.trim().toLowerCase();
        const key = 'saturday-session:' + address;
        let token;
        try { token = localStorage.getItem(key); } catch {}
        if (!token) token = crypto.randomUUID();
        try { localStorage.setItem(key, token); } catch {}
        try {
            const data = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: el('name').value, email: address, phone: el('phone').value, website: el('website').value, token, reserve }) });
            receipt(data, token);
        } catch (error) {
            if (error.message === 'full') { await availability(); notice('The last spot was just booked. You can join the reserve list below.'); }
            else if (error.message === 'spots_available') { await availability(); notice('A spot is available now. Click “Book my free spot” to book it.'); }
            else if (error.message === 'duplicate') notice('There’s already a booking or reserve entry for this email. Check your original confirmation, or text Shannon on 0478 209 395.');
            else if (error.message === 'closed') { await availability(); notice('Bookings are now closed.'); }
            else notice('We couldn’t confirm your booking. Please try again. Your place is only booked once you see a confirmation.');
        } finally { el('submit').disabled = false; }
    });
    el('retry').addEventListener('click', availability);
    el('another').addEventListener('click', () => { history.replaceState(null, '', location.pathname); el('receipt').hidden = true; el('booking').hidden = false; availability(); });
    (async () => {
        const token = location.hash.slice(1);
        if (/^[0-9a-f-]{36}$/i.test(token)) {
            try { receipt(await request({}, '?receipt=' + encodeURIComponent(token)), token); return; } catch { notice('That booking could not be loaded. Check your confirmation or contact Shannon.'); }
        }
        await availability();
    })();
})();
