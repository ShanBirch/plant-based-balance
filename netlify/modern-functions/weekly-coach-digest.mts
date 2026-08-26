import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/weekly-coach-digest.js';

export default withLambda(legacy.handler);
