import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/tahlia-social-worker.js';

export default withLambda(legacy.handler);
