import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/daily-reel-opportunity-scan.js';

export default withLambda(legacy.handler);
