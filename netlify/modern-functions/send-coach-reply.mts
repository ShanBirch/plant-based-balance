import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-coach-reply.js';

export default withLambda(legacy.handler);
