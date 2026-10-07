require("dotenv").config();

module.exports = {
    accentColor: 0x5865f2,
    guessGame: {
        defaultIntervalMinutes: Number(process.env.GUESS_INTERVAL_MINUTES || 30),
        minIntervalMinutes: 5,
        maxIntervalMinutes: 120,
        pointsBase: 10,
        pointsBonusMax: 7,
        roundDurationSeconds: Number(process.env.GUESS_ROUND_SECONDS || 60),
        /** Delay before the first scheduled round after setup (ms). 0 = as soon as the scheduler runs. */
        firstRoundDelayMs: Number(process.env.GUESS_FIRST_ROUND_DELAY_MS || 0),
    },
};
