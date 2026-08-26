import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/badge-earned-alert.js';

export default withLambda(legacy.handler);
