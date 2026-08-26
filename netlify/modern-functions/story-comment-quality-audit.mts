import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/story-comment-quality-audit.js';

export default withLambda(legacy.handler);
