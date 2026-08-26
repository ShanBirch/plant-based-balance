const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const learning = fs.readFileSync(path.join(__dirname, '..', 'lib', 'learning-inline.js'), 'utf8');
const firstLessonStart = learning.indexOf("id: 'mind-1-1'");
const secondLessonStart = learning.indexOf("id: 'mind-1-2'", firstLessonStart);
const thirdLessonStart = learning.indexOf("id: 'mind-1-3'", secondLessonStart);
const firstLesson = learning.slice(firstLessonStart, secondLessonStart);
const secondLesson = learning.slice(secondLessonStart, thirdLessonStart);

test('the first Foundations lesson introduces the researchers before teaching theory', () => {
  assert.match(learning, /'mind-1-1': 'Meet the Researchers'/);
  assert.match(learning, /'mind-1-2': 'Your Brain Guesses First'/);
  assert.match(firstLesson, /statistical parametric mapping and dynamic causal modelling/);
  assert.match(firstLesson, /the free-energy principle and active inference/);
  assert.match(firstLesson, /the theory of constructed emotion/);
  assert.match(firstLesson, /They do not endorse Balance/);
  assert.doesNotMatch(firstLesson, /controlled hallucination/);
  assert.match(secondLesson, /Your brain generates predictions BEFORE sensory signals even arrive/);
});

test('the first Foundations quiz checks the researcher lesson instead of the prediction lesson', () => {
  assert.match(firstLesson, /Karl Friston is a theoretical neuroscientist whose work includes active inference/);
  assert.match(firstLesson, /Lisa Feldman Barrett wrote How _______ Are Made/);
  assert.match(firstLesson, /Which work is Karl Friston known for/);
  assert.match(firstLesson, /Which statements describe Lisa Feldman Barrett's work/);
  assert.match(firstLesson, /Karl Friston and Lisa Feldman Barrett personally endorse Balance/);
  assert.doesNotMatch(firstLesson, /Your eyes send a complete picture/);
  assert.doesNotMatch(firstLesson, /You walk into a dark room and 'see' a snake/);
});
