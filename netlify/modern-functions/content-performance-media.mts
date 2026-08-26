import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/content-performance-media.js';

export default withLambda(legacy.handler);
