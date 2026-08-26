import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/first-workout-celebration.js';

export default withLambda(legacy.handler);
