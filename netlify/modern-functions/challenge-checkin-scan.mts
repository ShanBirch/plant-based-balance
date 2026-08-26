import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/challenge-checkin-scan.js';

export default withLambda(legacy.handler);
