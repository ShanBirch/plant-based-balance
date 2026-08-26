import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-engagement-priorities.js';

export default withLambda(legacy.handler);
