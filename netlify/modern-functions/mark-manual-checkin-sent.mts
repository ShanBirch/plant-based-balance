import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/mark-manual-checkin-sent.js';

export default withLambda(legacy.handler);
