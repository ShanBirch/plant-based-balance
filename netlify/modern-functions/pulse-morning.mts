import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/pulse-morning.js';

export default withLambda(legacy.handler);
