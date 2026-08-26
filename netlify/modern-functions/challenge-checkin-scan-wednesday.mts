import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/challenge-checkin-scan-wednesday.js';

export default withLambda(legacy.handler);
