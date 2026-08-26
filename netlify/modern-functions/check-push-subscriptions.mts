import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/check-push-subscriptions.js';

export default withLambda(legacy.handler);
