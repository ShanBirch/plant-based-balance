import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meal-plan-nutrition-audit.js';

export default withLambda(legacy.handler);
