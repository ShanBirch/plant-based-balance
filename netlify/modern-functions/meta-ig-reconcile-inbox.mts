import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-ig-reconcile-inbox.js';

export default withLambda(legacy.handler);
