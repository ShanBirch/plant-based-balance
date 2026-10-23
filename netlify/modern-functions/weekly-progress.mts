import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/weekly-progress.js';
export default withLambda(legacy.handler);
