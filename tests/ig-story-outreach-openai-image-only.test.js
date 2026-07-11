const assert = require('assert');

process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.STORY_COMMENT_OPENAI_ANALYSIS_FIRST = '1';
process.env.OPENAI_MODEL_CHAIN_STORY_VISION = 'gpt-4o-mini';
delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;

const { _test } = require('../netlify/functions/ig-story-outreach-candidate');

async function run() {
    assert.strictEqual(
        _test.shouldIncludeStoryVideoEvidence({ clean: 'base64-video' }),
        false,
        'OpenAI-first Story analysis must omit raw video evidence'
    );

    let requestBody = null;
    const originalFetch = global.fetch;
    global.fetch = async (url, options = {}) => {
        assert.strictEqual(url, 'https://api.openai.com/v1/responses');
        requestBody = JSON.parse(options.body);
        return {
            ok: true,
            status: 200,
            json: async () => ({ output_text: 'image analysis ok' }),
            text: async () => '',
        };
    };

    try {
        const result = await _test.callOpenAIStoryModel([{
            role: 'user',
            parts: [
                { text: 'Analyze this still Story photo.' },
                { inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } },
            ],
        }], { maxOutputTokens: 120, temperature: 0.2 });

        assert.strictEqual(result.text, 'image analysis ok');
        assert.strictEqual(result.model, 'gpt-4o-mini');
        const content = requestBody.input[0].content;
        assert.strictEqual(content.filter(part => part.type === 'input_image').length, 1);
        assert.strictEqual(content.some(part => /video/i.test(part.text || '')), false);
    } finally {
        global.fetch = originalFetch;
    }

    console.log('ig story outreach OpenAI image-only tests passed');
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
