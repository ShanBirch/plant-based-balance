import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/instant-coach-draft.js';

export default withLambda(legacy.handler);
