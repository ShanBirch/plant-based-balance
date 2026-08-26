import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/manychat-inbound.js';

export default withLambda(legacy.handler);
