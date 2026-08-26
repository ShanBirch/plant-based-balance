import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-direct-ig-message.js';

export default withLambda(legacy.handler);
