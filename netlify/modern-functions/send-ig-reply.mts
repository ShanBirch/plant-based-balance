import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-ig-reply.js';

export default withLambda(legacy.handler);
