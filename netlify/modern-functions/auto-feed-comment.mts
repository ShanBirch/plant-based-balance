import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/auto-feed-comment.js';

export default withLambda(legacy.handler);
