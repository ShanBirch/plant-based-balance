import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-ig-webhook.js';

export default withLambda(legacy.handler);
