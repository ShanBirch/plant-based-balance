import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/schedule-ig-thread-memory.js';

export default withLambda(legacy.handler);
