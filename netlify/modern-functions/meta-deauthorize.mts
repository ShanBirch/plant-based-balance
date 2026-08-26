import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/meta-deauthorize.js';

export default withLambda(legacy.handler);
