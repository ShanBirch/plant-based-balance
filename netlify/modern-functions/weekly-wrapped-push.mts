import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/weekly-wrapped-push.js';

export default withLambda(legacy.handler);
