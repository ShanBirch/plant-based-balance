import { withLambda } from '../modern-runtime/lambda-compat.mts';
import legacy from '../functions/weekly-checkin-scan.js';

export default withLambda(legacy.handler);
