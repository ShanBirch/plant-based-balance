import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/update-coach-instructions.js';

export default withLambda(legacy.handler);
