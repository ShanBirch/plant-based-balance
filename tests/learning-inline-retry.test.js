const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'learning-inline.js'),
    'utf8'
);

assert.ok(
    source.includes('function recordGameResult(isCorrect)') &&
    source.includes('learningState.currentGameAnswered = true;') &&
    (source.match(/recordGameResult\(/g) || []).length === 8,
    'all six learning game types, including an incorrect pair, should use the shared retry-safe result flow'
);

assert.strictEqual(
    (source.match(/learningState\.gamesPlayed\+\+/g) || []).length,
    1,
    'wrong attempts must not increment the lesson score denominator'
);

assert.ok(
    source.includes('learningState.currentGameAnswered = false;') &&
    (source.match(/if \(learningState\.currentGameAnswered\) return;/g) || []).length === 6,
    'each game type should block duplicate submissions until retry rerenders the question'
);

assert.ok(
    source.includes("continueBtn.innerText = isCorrect ? 'Continue' : 'Try This Question Again';") &&
    source.includes('else window.retryCurrentGameAfterFeedback();'),
    'wrong feedback should offer a retry instead of continuing to the next question'
);

assert.ok(
    source.includes('window.retryCurrentGameAfterFeedback = function()') &&
    source.includes('dismissGameFeedback(() => renderCurrentGame());') &&
    source.includes('learningState.currentGameIndex++;'),
    'retry should rerender the current question while Continue advances after success'
);

assert.ok(
    source.includes("document.querySelectorAll('.match-item').forEach(item =>") &&
    source.includes('showGameFeedback(false, game.explanation);'),
    'an incorrect pair should stop input and enter the same retry flow'
);

console.log('learning inline retry tests passed');
