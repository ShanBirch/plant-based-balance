import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/client-lead-manager.js';

export default withLambda(legacy.handler);
