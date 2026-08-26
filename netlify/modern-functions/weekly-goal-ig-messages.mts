import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/weekly-goal-ig-messages.js';

export default withLambda(legacy.handler);
