import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/free-starter-access.js';

export default withLambda(legacy.handler);
