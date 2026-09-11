// Lossless course-only copy: keep the original mesh, texture, rig and dance.
// Usage: node scripts/build-course-mascot.cjs original.glb destination.glb
const fs = require('node:fs');
const assert = require('node:assert/strict');
const [input, output] = process.argv.slice(2);
const original = fs.readFileSync(input);
assert.equal(original.toString('ascii', 0, 4), 'glTF');
const jsonLength = original.readUInt32LE(12);
const doc = JSON.parse(original.subarray(20, 20 + jsonLength));
assert.equal(doc.buffers.length, 1);
assert.deepEqual(doc.extensionsUsed, ['KHR_draco_mesh_compression']);
const bin = original.subarray(28 + jsonLength);
doc.animations = doc.animations.filter(a => a.name === 'dance');
assert.equal(doc.animations.length, 1);
const used = new Set();
for (const animation of doc.animations) for (const sampler of animation.samplers) {
    used.add(sampler.input); used.add(sampler.output);
}
for (const skin of doc.skins) used.add(skin.inverseBindMatrices);
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    used.add(primitive.indices);
    Object.values(primitive.attributes).forEach(index => used.add(index));
    assert.ok(!primitive.targets, 'Revisit packing if morph targets are added');
}
const indices = [...used].sort((a, b) => a - b);
const remap = new Map(indices.map((old, index) => [old, index]));
doc.accessors = indices.map(index => doc.accessors[index]);
for (const animation of doc.animations) for (const sampler of animation.samplers) {
    sampler.input = remap.get(sampler.input); sampler.output = remap.get(sampler.output);
}
for (const skin of doc.skins) skin.inverseBindMatrices = remap.get(skin.inverseBindMatrices);
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    primitive.indices = remap.get(primitive.indices);
    for (const key of Object.keys(primitive.attributes)) primitive.attributes[key] = remap.get(primitive.attributes[key]);
}
const views = new Set();
for (const accessor of doc.accessors) {
    assert.ok(!accessor.sparse, 'Revisit packing if sparse accessors are added');
    if (accessor.bufferView !== undefined) views.add(accessor.bufferView);
}
for (const image of doc.images) views.add(image.bufferView);
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) views.add(primitive.extensions.KHR_draco_mesh_compression.bufferView);
const viewIndices = [...views].sort((a, b) => a - b);
const viewMap = new Map(viewIndices.map((old, index) => [old, index]));
let offset = 0;
const chunks = [];
doc.bufferViews = viewIndices.map(index => {
    const view = doc.bufferViews[index];
    const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const padding = Buffer.alloc((4 - bytes.length % 4) % 4);
    const packed = { ...view, byteOffset: offset };
    chunks.push(bytes, padding); offset += bytes.length + padding.length;
    return packed;
});
for (const accessor of doc.accessors) if (accessor.bufferView !== undefined) accessor.bufferView = viewMap.get(accessor.bufferView);
for (const image of doc.images) image.bufferView = viewMap.get(image.bufferView);
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    const draco = primitive.extensions.KHR_draco_mesh_compression;
    draco.bufferView = viewMap.get(draco.bufferView);
}
doc.buffers = [{ byteLength: offset }];
const json = Buffer.from(JSON.stringify(doc));
const jsonPadded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
header.write('glTF'); header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + jsonPadded.length + offset, 8);
header.writeUInt32LE(jsonPadded.length, 12); header.write('JSON', 16);
binHeader.writeUInt32LE(offset); binHeader.write('BIN\0', 4);
fs.writeFileSync(output, Buffer.concat([header, jsonPadded, binHeader, ...chunks]));
console.log(`${original.length} -> ${fs.statSync(output).size} bytes; original geometry, texture and dance retained`);
