import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meal-shop-schedule.js';
export default withLambda(legacy.handler);
