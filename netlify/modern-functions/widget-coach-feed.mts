import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/widget-coach-feed.js';

export default withLambda(legacy.handler);
