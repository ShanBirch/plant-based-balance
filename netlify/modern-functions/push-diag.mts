import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/push-diag.js';

export default withLambda(legacy.handler);
