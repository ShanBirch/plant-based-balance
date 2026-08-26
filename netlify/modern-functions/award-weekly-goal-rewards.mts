import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/award-weekly-goal-rewards.js';

export default withLambda(legacy.handler);
