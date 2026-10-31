import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/coaching-support-preview.js';
export default withLambda(legacy.handler);
