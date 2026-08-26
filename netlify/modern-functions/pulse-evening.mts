import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/pulse-evening.js';

export default withLambda(legacy.handler);
