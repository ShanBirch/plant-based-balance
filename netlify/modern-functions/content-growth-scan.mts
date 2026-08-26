import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/content-growth-scan.js';

export default withLambda(legacy.handler);
