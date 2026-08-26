import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/submit-form-check-request.js';

export default withLambda(legacy.handler);
