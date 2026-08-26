import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/support-radar-scan.js';

export default withLambda(legacy.handler);
