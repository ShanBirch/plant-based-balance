import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/conversion-operator-action.js';

export default withLambda(legacy.handler);
