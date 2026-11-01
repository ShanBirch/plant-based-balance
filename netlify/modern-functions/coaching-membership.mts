import {withLambda} from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/coaching-membership.js';
export default withLambda(legacy.handler);
