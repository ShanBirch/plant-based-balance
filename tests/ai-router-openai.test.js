const assert = require('assert');

const {
    callOpenAIModelChain,
    convertGeminiContentsToOpenAIInput,
    resolveOpenAIModelChain,
} = require('../netlify/functions/_lib/ai-router');

const geminiContents = [{
    role: 'user',
    parts: [
        { text: 'reply like Shannon' },
        {
            inline_data: {
                mime_type: 'image/jpeg',
                data: 'abc123',
            },
        },
    ],
}];

const input = convertGeminiContentsToOpenAIInput(geminiContents);
assert.strictEqual(input.length, 1);
assert.strictEqual(input[0].role, 'user');
assert.deepStrictEqual(input[0].content[0], { type: 'input_text', text: 'reply like Shannon' });
assert.deepStrictEqual(input[0].content[1], {
    type: 'input_image',
    image_url: 'data:image/jpeg;base64,abc123',
});

assert.deepStrictEqual(resolveOpenAIModelChain({ profile: 'coach_fallback' }), ['gpt-5.4-mini']);

const originalFetch = global.fetch;
let capturedBody = null;
global.fetch = async (url, options) => {
    assert.strictEqual(url, 'https://api.openai.com/v1/responses');
    assert.strictEqual(options.headers.Authorization, 'Bearer test-key');
    capturedBody = JSON.parse(options.body);
    return {
        ok: true,
        json: async () => ({
            output_text: 'nice work',
            usage: { input_tokens: 10, output_tokens: 3, total_tokens: 13 },
        }),
    };
};

(async () => {
    try {
        const { data, model } = await callOpenAIModelChain({
            apiKey: 'test-key',
            profile: 'coach_fallback',
            label: 'test-openai',
            payload: {
                contents: geminiContents,
                generationConfig: {
                    maxOutputTokens: 120,
                    temperature: 0.2,
                },
            },
        });
        assert.strictEqual(model, 'gpt-5.4-mini');
        assert.strictEqual(capturedBody.model, 'gpt-5.4-mini');
        assert.strictEqual(capturedBody.max_output_tokens, 120);
        assert.strictEqual(capturedBody.temperature, 0.2);
        assert.strictEqual(capturedBody.input[0].content[1].type, 'input_image');
        assert.strictEqual(data.candidates[0].content.parts[0].text, 'nice work');
        assert.strictEqual(data.usageMetadata.totalTokenCount, 13);
        console.log('ai router OpenAI tests passed');
    } finally {
        global.fetch = originalFetch;
    }
})().catch(err => {
    global.fetch = originalFetch;
    console.error(err);
    process.exit(1);
});
