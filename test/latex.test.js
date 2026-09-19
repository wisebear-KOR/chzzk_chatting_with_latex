// index.html 안의 <script id="latex-core"> 블록만 떼어 내 실제 KaTeX 로 검증한다.
// 실행: npm install && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const katex = require('katex');
require('katex/dist/contrib/mhchem.js');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = /<script id="latex-core">([\s\S]*?)<\/script>/.exec(html)[1];
const sandbox = {};
vm.runInNewContext(core, sandbox);
const { parseMessage } = sandbox.ChzzkLatex;

// 위젯의 renderMath 와 같은 기준: 렌더링 실패 또는 trust 가 필요한 명령이면 수식이 아니다.
function isValid(tex, displayMode) {
  let untrusted = false;
  try {
    katex.renderToString(tex, {
      displayMode, throwOnError: true, strict: 'ignore', output: 'html', maxSize: 8, maxExpand: 100,
      trust: () => { untrusted = true; return false; },
    });
  } catch {
    return false;
  }
  return !untrusted;
}

const R = String.raw;
const parse = (msg, options = {}) => parseMessage(msg, { isValid, ...options });
// 비교하기 쉽게: 글자는 문자열, 수식은 [tex, display]
// (vm 컨텍스트의 배열은 프로토타입이 달라 deepEqual 이 거부하므로 Array.from 으로 옮겨 담는다)
const shape = (msg, options) =>
  Array.from(parse(msg, options).segments, (s) => (s.type === 'math' ? [s.tex, s.display] : s.type === 'emoji' ? `<${s.name}>` : s.value));
const plain = (msg, options) => assert.deepEqual(shape(msg, options), [msg]);

test('구분자: $...$ 는 문장 안 수식', () => {
  assert.deepEqual(shape(R`오일러 공식 $e^{i\pi}+1=0$ 예쁨`), ['오일러 공식 ', [R`e^{i\pi}+1=0`, false], ' 예쁨']);
});

test('구분자: $$...$$ 와 \\[...\\] 는 display, \\(...\\) 는 inline', () => {
  assert.deepEqual(shape(R`보세요 $$\int_0^1 x\,dx$$ 끝`), ['보세요 ', [R`\int_0^1 x\,dx`, true], ' 끝']);
  assert.deepEqual(shape(R`a \[x^2\] b`), ['a ', ['x^2', true], ' b']);
  assert.deepEqual(shape(R`a \(x^2\) b`), ['a ', ['x^2', false], ' b']);
});

test('수식만 보낸 채팅은 display 로 승격', () => {
  assert.deepEqual(shape(R`$\frac{1}{2}$`), [[R`\frac{1}{2}`, true]]);
  assert.deepEqual(shape(R`  \frac{1}{2} `), ['  ', [R`\frac{1}{2}`, true], ' ']);
  assert.equal(parse(R`$a$ 그리고 $b$`).segments.filter((s) => s.type === 'math').every((s) => !s.display), true);
});

test('금액 표기는 수식이 아니다', () => {
  plain('가격은 $5 아니면 $10 임');
  plain('$100 주면 $200 줄게');
  plain('가격 $5~$10');
  plain(R`\$5 짜리`);
});

test('이모티콘/경로는 수식이 아니다', () => {
  plain('^^ ^_^ T_T >_< o_O');
  plain(R`\o/ 만세`);
  plain(R`\(^o^)/ 안녕 \(^o^)/`);
  plain(R`¯\_(ツ)_/¯`);
  plain(R`C:\Users\name\temp 폴더`);
  plain('x^2 은 구분자 없이는 그대로');
});

test('자동 감지: 구분자 없는 LaTeX 명령', () => {
  assert.deepEqual(shape(R`답은 \frac{1}{2} 입니다`), ['답은 ', [R`\frac{1}{2}`, false], ' 입니다']);
  assert.deepEqual(shape(R`근의 공식은 x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} 입니다`), [
    '근의 공식은 ', [R`x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`, false], ' 입니다',
  ]);
  assert.deepEqual(shape(R`\int_0^1 x^2 dx = \frac{1}{3} 맞죠?`), [[R`\int_0^1 x^2 dx = \frac{1}{3}`, false], ' 맞죠?']);
  assert.deepEqual(shape(R`x^{2}+y^{2}=z^{2} 피타고라스`), [[R`x^{2}+y^{2}=z^{2}`, false], ' 피타고라스']);
});

test('자동 감지: 한글이 붙어 있어도, 중괄호 안 한글은 수식의 일부', () => {
  assert.deepEqual(shape(R`속력=\frac{거리}{시간}임`), ['속력', [R`=\frac{거리}{시간}`, false], '임']);
  assert.deepEqual(shape(R`답은\sqrt{2}야`), ['답은', [R`\sqrt{2}`, false], '야']);
  assert.deepEqual(shape(R`\text{안녕 하세요} 테스트`), [[R`\text{안녕 하세요}`, false], ' 테스트']);
});

test('자동 감지: 영어 단어에서 끊는다', () => {
  assert.deepEqual(shape(R`lol \frac{1}{2} is half`), ['lol ', [R`\frac{1}{2}`, false], ' is half']);
  assert.deepEqual(shape(R`I don't know \alpha ...`), [R`I don't know `, [R`\alpha`, false], ' ...']);
});

test('자동 감지: 묶음이 실패하면 토큰 단위로 다시 시도', () => {
  assert.deepEqual(shape(R`^^ \alpha 짱`), ['^^ ', [R`\alpha`, false], ' 짱']);
});

test('자동 감지: 환경(\\begin..\\end)은 공백이 있어도 한 덩어리, display 전용 환경은 display', () => {
  const matrix = R`\begin{pmatrix} a & b \\ c & d \end{pmatrix}`;
  assert.deepEqual(shape(`A = ${matrix} 임`), [[`A = ${matrix}`, false], ' 임']);
  const align = R`\begin{align} a &= b \\ c &= d \end{align}`;
  assert.deepEqual(shape(`이거 ${align} 맞음`), ['이거 ', [align, true], ' 맞음']);
});

test('문법 오류는 원문 그대로', () => {
  plain(R`$\frac{1}{2$ 오타`);
  plain(R`\frac{1}{2 오타`);
  plain(R`$\undefinedcommand$`);
});

test('신뢰할 수 없는 명령(\\href 등)은 수식으로 그리지 않는다', () => {
  plain(R`$\href{https://evil.example}{click}$`);
  plain(R`\url{https://evil.example}`);
  plain(R`$\includegraphics{https://evil.example/a.png}$`);
  plain(R`$\htmlStyle{position:fixed}{x}$`);
});

test('매크로 폭탄은 실패 처리되고 메시지 간에 매크로가 공유되지 않는다', () => {
  plain(R`$\def\a{\a\a}\a$`);
  assert.equal(parse(R`$\gdef\foo{1}\foo$`).hasMath, true);
  plain(R`$\foo$`);
});

test('이모티콘 토큰', () => {
  const emojis = { d_1: 'https://ssl.pstatic.net/static/nng/glive/icon/cheese02.png' };
  assert.deepEqual(shape(R`안녕 {:d_1:} $x^2$ {:nope:}`, { emojis }), ['안녕 ', '<d_1>', ' ', ['x^2', false], ' {:nope:}']);
});

test('detect 옵션', () => {
  assert.deepEqual(shape(R`\frac{1}{2} 와 $x$`, { detect: 'delimiter' }), [R`\frac{1}{2} 와 `, ['x', false]]);
  plain(R`\frac{1}{2} 와 $x$`, { detect: 'off' });
});

test('화학식 (mhchem)', () => {
  assert.deepEqual(shape(R`\ce{2H2 + O2 -> 2H2O}`), [[R`\ce{2H2 + O2 -> 2H2O}`, true]]);
});

test('수식 개수 상한', () => {
  const many = Array.from({ length: 12 }, (_, i) => `$x_${i}$`).join(' ');
  assert.equal(parse(many).segments.filter((s) => s.type === 'math').length, 8);
});
