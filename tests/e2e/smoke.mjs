// 스모크 테스트: 페이지가 오류 없이 열리는지 확인
// 사용: node tests/e2e/smoke.mjs
import assert from 'node:assert/strict';
import { startServer } from './server.mjs';
import { launch } from './browser.mjs';

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch();
try {
  await browser.goto(base);
  await browser.waitFor('document.querySelector("h1")');
  assert.match(await browser.eval('document.title'), /Numpad Dojo/);
  const errors = browser.logs.filter((l) => /exception|\[error\]/.test(l));
  assert.deepEqual(errors, [], '콘솔 오류가 없어야 함');
  console.log('✓ smoke: 페이지 로드, 제목, 콘솔 오류 없음');
} finally {
  await browser.close();
  server.close();
}
