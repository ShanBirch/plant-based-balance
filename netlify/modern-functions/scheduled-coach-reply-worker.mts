import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/scheduled-coach-reply-worker.js';

export default withLambda(legacy.handler);
