import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/manychat-reconcile.js';

export default withLambda(legacy.handler);
