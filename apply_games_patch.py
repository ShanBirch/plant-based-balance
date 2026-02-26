import sys

with open('lib/games.js', 'r') as f:
    text = f.read()

# Replace accept/decline logic
search1 = """      if (modal) modal.remove();
      showGameToast('Challenge accepted! Let\\'s play!');
      if (typeof loadCoinBalance === 'function') loadCoinBalance();
      openGameBoard(matchId);
    } else {
      await db.games.declineChallenge(matchId, window.currentUser.id);
      if (modal) modal.remove();
      showGameToast('Challenge declined');
    }"""

replace1 = """      if (modal) modal.remove();
      showGameToast('Challenge accepted! Let\\'s play!');
      try {
        let m = await db.games.getMatch(matchId);
        await window.supabaseClient.from('nudges').insert({
          sender_id: window.currentUser.id, receiver_id: m.challenger_id,
          message: `🎮 I accepted your ${GAME_CONFIG[m.game_type]?.name || 'game'} challenge! It\\'s your turn!`
        });
      } catch (e) {}
      if (typeof loadCoinBalance === 'function') loadCoinBalance();
      openGameBoard(matchId);
    } else {
      await db.games.declineChallenge(matchId, window.currentUser.id);
      if (modal) modal.remove();
      showGameToast('Challenge declined');
      try {
        let m = await db.games.getMatch(matchId);
        await window.supabaseClient.from('nudges').insert({
          sender_id: window.currentUser.id, receiver_id: m.challenger_id,
          message: `😔 I declined your ${GAME_CONFIG[m.game_type]?.name || 'game'} challenge.`
        });
      } catch (e) {}
    }"""

# Replace makeGameMove normal move
search2 = """    // Normal move - update state and switch turn
    const updatedMatch = await db.games.updateGameState(
      matchId,
      { board: newBoard },
      nextTurn,
      (match.move_count || 0) + 1
    );

    activeGameMatch = updatedMatch;
    updateTurnIndicator(nextTurn === myId, updatedMatch);"""

replace2 = """    // Normal move - update state and switch turn
    const updatedMatch = await db.games.updateGameState(
      matchId,
      { board: newBoard },
      nextTurn,
      (match.move_count || 0) + 1
    );

    try {
      if (nextTurn !== myId && !match.is_local) {
        await window.supabaseClient.from('nudges').insert({
          sender_id: myId, receiver_id: nextTurn,
          message: `🎮 It\\'s your turn in ${GAME_CONFIG[match.game_type]?.name || 'a game'}!`
        });
      }
    } catch (e) {}

    activeGameMatch = updatedMatch;
    updateTurnIndicator(nextTurn === myId, updatedMatch);"""

# Replace makeGameMove complete game
search3 = """      const winnerId = checkResult.winner === 'me' ? myId : (match.challenger_id === myId ? match.opponent_id : match.challenger_id);
      await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);
      await db.games.completeGame(matchId, winnerId, false);
      // Result will be shown by polling
      return;
    }"""

replace3 = """      const winnerId = checkResult.winner === 'me' ? myId : (match.challenger_id === myId ? match.opponent_id : match.challenger_id);
      await db.games.updateGameState(matchId, { board: newBoard }, nextTurn, (match.move_count || 0) + 1);
      await db.games.completeGame(matchId, winnerId, false);
      
      try {
        if (!match.is_local) {
          const oppId = match.challenger_id === myId ? match.opponent_id : match.challenger_id;
          const msg = checkResult.winner === 'me' ? `🏆 I won our game of ${GAME_CONFIG[match.game_type]?.name || 'game'}!` : `🎮 You won our game of ${GAME_CONFIG[match.game_type]?.name || 'game'}!`;
          await window.supabaseClient.from('nudges').insert({
            sender_id: myId, receiver_id: oppId, message: msg
          });
        }
      } catch (e) {}

      // Result will be shown by polling
      return;
    }"""

if search1 in text:
    text = text.replace(search1, replace1)
if search2 in text:
    text = text.replace(search2, replace2)
if search3 in text:
    text = text.replace(search3, replace3)

with open('lib/games.js', 'w') as f:
    f.write(text)

print("Done")
