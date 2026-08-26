import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/add-ig-screenshot-context.js';

export default withLambda(legacy.handler);
