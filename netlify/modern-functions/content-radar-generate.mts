import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/content-radar-generate.js';

export default withLambda(legacy.handler);
