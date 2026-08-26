import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/tahlia-feed-approvals.js';

export default withLambda(legacy.handler);
