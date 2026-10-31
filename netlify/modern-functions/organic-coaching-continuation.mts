import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/organic-coaching-continuation.js';
export default withLambda(legacy.handler);
