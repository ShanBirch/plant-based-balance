import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/log-lp-event.js';

export default withLambda(legacy.handler);
