import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/extract-client-memory.js';

export default withLambda(legacy.handler);
