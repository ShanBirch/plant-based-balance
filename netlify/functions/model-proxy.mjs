/**
 * Model Proxy — Netlify serverless function
 *
 * Fetches a GLB model from Backblaze B2 (or any URL), decompresses
 * KHR_draco_mesh_compression if present, and returns a clean GLB
 * that GLTFKit2 / SceneKit can load on iOS.
 *
 * Usage:  GET /api/model-proxy?url=<encoded-b2-url>
 *
 * The iOS native-character-viewer-bridge routes model loads through
 * this endpoint so the native SceneKit viewer receives Draco-free GLBs.
 * The native plugin caches the result on disk, so each model only
 * hits this function once per device.
 */

import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

// Cache decompressed models in memory for the lifetime of the function instance.
// Netlify keeps warm instances for ~15 minutes, so repeated requests for
// the same model skip the fetch+decompress cycle.
const cache = new Map();

export async function handler(event) {
    const url = event.queryStringParameters?.url;

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing ?url= parameter' })
        };
    }

    // Only allow requests from known model hosts
    const allowed = ['f005.backblazeb2.com', 'backblazeb2.com'];
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid URL' })
        };
    }
    if (!allowed.some(h => parsed.hostname.endsWith(h))) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Host not allowed: ' + parsed.hostname })
        };
    }

    try {
        // Check in-memory cache
        if (cache.has(url)) {
            const cached = cache.get(url);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'model/gltf-binary',
                    'Cache-Control': 'public, max-age=604800, immutable',
                    'X-Model-Source': 'cache'
                },
                body: cached.toString('base64'),
                isBase64Encoded: true
            };
        }

        // Fetch the original GLB
        const response = await fetch(url);
        if (!response.ok) {
            return {
                statusCode: 502,
                body: JSON.stringify({ error: `Upstream returned ${response.status}` })
            };
        }

        const arrayBuffer = await response.arrayBuffer();
        const inputBuffer = new Uint8Array(arrayBuffer);

        // Quick check: does this GLB even use Draco?
        // Look for the extension string in the JSON chunk.
        const jsonStr = extractGLBJsonChunk(inputBuffer);
        if (!jsonStr || !jsonStr.includes('KHR_draco_mesh_compression')) {
            // No Draco — pass through as-is
            const buf = Buffer.from(arrayBuffer);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'model/gltf-binary',
                    'Cache-Control': 'public, max-age=604800, immutable',
                    'X-Model-Source': 'passthrough'
                },
                body: buf.toString('base64'),
                isBase64Encoded: true
            };
        }

        // Decompress Draco
        const decoderModule = await draco3d.createDecoderModule();
        const io = new NodeIO()
            .registerExtensions([KHRDracoMeshCompression])
            .registerDependencies({
                'draco3d.decoder': decoderModule
            });

        const document = await io.readBinary(inputBuffer);

        // Remove the Draco extension — this decompresses all mesh data
        // into standard glTF accessors/buffer views.
        for (const ext of document.getRoot().listExtensionsUsed()) {
            if (ext.extensionName === 'KHR_draco_mesh_compression') {
                ext.dispose();
            }
        }

        // Write back to a clean GLB
        const outputBuffer = await io.writeBinary(document);
        const buf = Buffer.from(outputBuffer);

        // Cache if under 5MB (leave room for base64 overhead within 6MB limit)
        if (buf.length < 5 * 1024 * 1024) {
            cache.set(url, buf);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'model/gltf-binary',
                'Cache-Control': 'public, max-age=604800, immutable',
                'X-Model-Source': 'decompressed',
                'X-Original-Size': String(inputBuffer.length),
                'X-Decompressed-Size': String(buf.length)
            },
            body: buf.toString('base64'),
            isBase64Encoded: true
        };

    } catch (err) {
        console.error('[model-proxy] Error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Decompression failed',
                message: err.message || String(err)
            })
        };
    }
}

/**
 * Extract the JSON chunk from a GLB file as a string.
 * GLB format: 12-byte header, then chunks. First chunk is JSON.
 */
function extractGLBJsonChunk(data) {
    if (data.length < 20) return null;
    // GLB magic: 0x46546C67 ('glTF')
    const magic = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
    if (magic !== 0x46546C67) return null;

    // First chunk starts at byte 12
    const chunkLength = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24);
    const chunkType = data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24);

    // JSON chunk type: 0x4E4F534A ('JSON')
    if (chunkType !== 0x4E4F534A) return null;

    const jsonBytes = data.slice(20, 20 + chunkLength);
    return new TextDecoder().decode(jsonBytes);
}
