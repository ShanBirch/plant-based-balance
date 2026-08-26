import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-story-outreach-candidate.js';

export default withLambda(legacy.handler);
