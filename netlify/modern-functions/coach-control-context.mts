import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/coach-control-context.js';

export default withLambda(legacy.handler);
