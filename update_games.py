import re

with open("lib/games.js", "r") as f:
    text = f.read()

text = text.replace(
    "showGameToast('Challenge accepted! Let\\'s play!');",
    "showGameToast('Challenge accepted! Let\\'s play!');\n      try { let m = await db.games.getMatch(matchId); await window.supabaseClient.from('nudges').insert({ sender_id: window.currentUser.id, receiver_id: m.challenger_id, message: `🎮 I accepted your ${GAME_CONFIG[m.game_type]?.name || 'game'} challenge! It\\'s your turn!` }); } catch(e) {}"
)

text = text.replace(
    "showGameToast('Challenge declined');",
    "showGameToast('Challenge declined');\n      try { let m = await db.games.getMatch(matchId); await window.supabaseClient.from('nudges').insert({ sender_id: window.currentUser.id, receiver_id: m.challenger_id, message: `😔 I declined your ${GAME_CONFIG[m.game_type]?.name || 'game'} challenge.` }); } catch(e) {}"
)

text = text.replace(
    "await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);\n    activeGameMatch = updatedMatch;",
    "await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);\n\n    try { if (nextTurn !== myId && !match.is_local) { await window.supabaseClient.from('nudges').insert({ sender_id: myId, receiver_id: nextTurn, message: `🎮 It\\'s your turn in ${GAME_CONFIG[match.game_type]?.name || 'a game'}!` }); } } catch (e) {}\n\n    activeGameMatch = updatedMatch;"
)

text = text.replace(
    "await db.games.completeGame(matchId, winnerId, false);\n      // Result will be shown by polling\n      return;",
    "await db.games.completeGame(matchId, winnerId, false);\n      try { if (!match.is_local) { const oppId = match.challenger_id === myId ? match.opponent_id : match.challenger_id; const msg = checkResult.winner === 'me' ? `🏆 I won our game of ${GAME_CONFIG[match.game_type]?.name || 'game'}!` : `🎮 You won our game of ${GAME_CONFIG[match.game_type]?.name || 'game'}!`; await window.supabaseClient.from('nudges').insert({ sender_id: myId, receiver_id: oppId, message: msg }); } } catch(e) {}\n      // Result will be shown by polling\n      return;"
)


with open("lib/games.js", "w") as f:
    f.write(text)
