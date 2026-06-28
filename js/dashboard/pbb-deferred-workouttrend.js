// Workout trend cards are retired. Keep no-op globals for stale cached pages.
(function() {
    function hideRetiredWorkoutTrendCards() {
        var ids = ['daily-workout-trend-card', 'movement-workout-trend-card'];
        ids.forEach(function(id) {
            var card = document.getElementById(id);
            if (card) card.style.display = 'none';
        });
    }

    async function noopWorkoutTrendCard() {
        hideRetiredWorkoutTrendCards();
    }

    window.checkAndShowWorkoutTrendCard = noopWorkoutTrendCard;
    window.loadMovementTrendCard = noopWorkoutTrendCard;
    window.dismissWorkoutTrendCard = hideRetiredWorkoutTrendCards;
    window.dismissMovementTrendCard = hideRetiredWorkoutTrendCards;
})();
