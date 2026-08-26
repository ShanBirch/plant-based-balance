import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/daily-message-learning.js';

export default withLambda(legacy.handler);
