import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-media-retry-worker.js';

export default withLambda(legacy.handler);
