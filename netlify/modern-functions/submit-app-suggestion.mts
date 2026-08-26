import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/submit-app-suggestion.js';

export default withLambda(legacy.handler);
