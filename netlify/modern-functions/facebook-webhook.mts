import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/facebook-webhook.js';

export default withLambda(legacy.handler);
