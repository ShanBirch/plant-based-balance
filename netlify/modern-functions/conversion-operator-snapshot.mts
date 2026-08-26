import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/conversion-operator-snapshot.js';

export default withLambda(legacy.handler);
