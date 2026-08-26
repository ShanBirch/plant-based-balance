import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/weekly-checkin-scan.js';

export default withLambda(legacy.handler);
