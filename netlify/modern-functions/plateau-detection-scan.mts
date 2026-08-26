import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/plateau-detection-scan.js';

export default withLambda(legacy.handler);
