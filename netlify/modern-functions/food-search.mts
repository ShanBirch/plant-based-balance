import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/food-search.js';

export default withLambda(legacy.handler);
