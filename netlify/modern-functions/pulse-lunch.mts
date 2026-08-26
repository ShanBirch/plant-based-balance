import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/pulse-lunch.js';

export default withLambda(legacy.handler);
