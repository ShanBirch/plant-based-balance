import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-preview-feed.js';

export default withLambda(legacy.handler);
