import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/ig-operator-command.js';

export default withLambda(legacy.handler);
