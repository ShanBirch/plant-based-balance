import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/learn-ai-experiment.js';
export default withLambda(legacy.handler);
