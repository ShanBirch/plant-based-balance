import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/clear-your-call-alerts.js';

export default withLambda(legacy.handler);
