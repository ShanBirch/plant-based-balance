import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-instant-draft.js';

export default withLambda(legacy.handler);
