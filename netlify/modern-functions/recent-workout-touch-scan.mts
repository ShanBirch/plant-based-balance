import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/recent-workout-touch-scan.js';

export default withLambda(legacy.handler);
