import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/master-form-check-status.js';

export default withLambda(legacy.handler);
