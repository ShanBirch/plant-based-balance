import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/dismiss-coach-reply.js';

export default withLambda(legacy.handler);
