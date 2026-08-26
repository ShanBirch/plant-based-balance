import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/send-instagram-graph-action.js';

export default withLambda(legacy.handler);
