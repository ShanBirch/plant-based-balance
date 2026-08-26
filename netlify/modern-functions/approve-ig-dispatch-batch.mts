import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/approve-ig-dispatch-batch.js';

export default withLambda(legacy.handler);
