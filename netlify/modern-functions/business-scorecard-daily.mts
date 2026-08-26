import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/business-scorecard-daily.js';

export default withLambda(legacy.handler);
