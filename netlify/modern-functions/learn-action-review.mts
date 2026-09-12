import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/learn-action-review.js';
export default withLambda(legacy.handler);
