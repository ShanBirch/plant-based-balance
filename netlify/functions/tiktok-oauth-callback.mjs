import {
  fetchUserInfo,
  html,
  saveConnection,
  tiktokRedirectUri,
  tokenRequest,
  verifySignedState,
} from './_lib/tiktok-content.mjs';

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function donePage(title, detail, isError = false) {
  const qs = isError ? '?tiktok_error=1' : '?tiktok_connected=1';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - Balance</title>
  <meta http-equiv="refresh" content="2;url=/tiktok-content.html${qs}">
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#f8fafc;min-height:100vh;display:grid;place-items:center;margin:0;padding:24px}
    main{max-width:520px;background:#111827;border:1px solid #334155;border-radius:12px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.35)}
    h1{margin:0 0 10px;font-size:1.4rem}p{color:#cbd5e1;line-height:1.5}a{color:#86efac}
  </style>
</head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><p><a href="/tiktok-content.html${qs}">Return to TikTok content</a></p></main></body>
</html>`;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  if (error) {
    return html(400, donePage('TikTok connection cancelled', url.searchParams.get('error_description') || error, true));
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !verifySignedState(state)) {
    return html(400, donePage('TikTok connection failed', 'The TikTok callback was missing a valid code or state.', true));
  }

  try {
    const token = await tokenRequest({
      code,
      grant_type: 'authorization_code',
      redirect_uri: tiktokRedirectUri(),
    });
    const profile = await fetchUserInfo(token.access_token);
    await saveConnection(token, profile);
    return html(200, donePage('TikTok connected', 'Balance can now upload approved videos to the connected TikTok account.'));
  } catch (error) {
    return html(500, donePage('TikTok connection failed', error.message || 'Could not finish TikTok OAuth.', true));
  }
}
