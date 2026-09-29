import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-reaction-connection-check.js';

export default withLambda(legacy.handler);
