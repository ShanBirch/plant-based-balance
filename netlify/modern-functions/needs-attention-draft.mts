import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/needs-attention-draft.js';

export default withLambda(legacy.handler);
