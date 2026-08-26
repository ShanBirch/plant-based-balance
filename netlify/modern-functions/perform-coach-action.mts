import { withLambda } from '../modern-runtime/lambda-compat.mts';
import 'vm';
import legacy from '../functions/perform-coach-action.js';

export default withLambda(legacy.handler);
