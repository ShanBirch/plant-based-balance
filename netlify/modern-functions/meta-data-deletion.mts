import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-data-deletion.js';

export default withLambda(legacy.handler);
