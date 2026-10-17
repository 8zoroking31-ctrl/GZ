import { createRouterCommand } from '../../utils/commandRouter.js';
import rankCommand from './modules/rank.js';
import leaderboardCommand from './modules/leaderboard.js';

export default createRouterCommand({
  name: 'rank',
  description: 'Show ranks and the level leaderboard',
  category: 'Leveling',
  routes: [
    { legacyName: 'rank', module: rankCommand },
    { legacyName: 'leaderboard', module: leaderboardCommand },
  ],
});
