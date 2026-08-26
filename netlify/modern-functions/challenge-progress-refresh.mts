import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/challenge-progress-refresh.js';

export default withLambda(legacy.handler);
