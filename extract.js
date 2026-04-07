const fs = require('fs');

try {
    const html = fs.readFileSync('dashboard.html', 'utf8');
    const idx = html.indexOf('PICK A GAME');
    if (idx !== -1) {
        fs.writeFileSync('games_extract.txt', html.substring(Math.max(0, idx - 500), Math.min(html.length, idx + 4000)));
    } else {
        fs.writeFileSync('games_extract.txt', 'NOT FOUND');
    }
} catch (e) {
    fs.writeFileSync('games_extract.txt', e.message);
}