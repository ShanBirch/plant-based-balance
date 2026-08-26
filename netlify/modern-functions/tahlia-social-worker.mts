import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/tahlia-social-worker.js';

export default withLambda(legacy.handler);
