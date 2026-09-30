// SVG 선 그래프: 주 지표 p.value(왼쪽 축) + 정확도(보조선, 0~100%)
import { svg } from './dom.js';

export function lineChart(points, { width = 640, height = 220, unit = '점' } = {}) {
  const pad = { top: 16, right: 16, bottom: 24, left: 48 };
  const w = width - pad.left - pad.right;
  const hgt = height - pad.top - pad.bottom;
  const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-label': `${unit}와 정확도 추이 그래프` });

  if (points.length === 0) return root;

  const maxV = niceMax(Math.max(...points.map((p) => p.value), 10));
  const x = (i) => pad.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const yV = (v) => pad.top + hgt - (v / maxV) * hgt;
  const yA = (v) => pad.top + hgt - v * hgt;

  // 가로 격자와 축 눈금
  for (let i = 0; i <= 4; i++) {
    const v = (maxV / 4) * i;
    const y = yV(v);
    root.append(svg('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: 'chart__grid' }));
    const label = svg('text', { x: pad.left - 8, y: y + 4, class: 'chart__tick', 'text-anchor': 'end' });
    label.textContent = Math.round(v).toLocaleString('ko-KR');
    root.append(label);
  }

  const path = (fn) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${fn(p).toFixed(1)}`).join('');

  // 주 지표 영역 채우기
  const area = `${path((p) => yV(p.value))}L${x(points.length - 1).toFixed(1)},${pad.top + hgt}L${x(0).toFixed(1)},${pad.top + hgt}Z`;
  root.append(svg('path', { d: area, class: 'chart__area' }));
  root.append(svg('path', { d: path((p) => yA(p.accuracy)), class: 'chart__line chart__line--acc' }));
  root.append(svg('path', { d: path((p) => yV(p.value)), class: 'chart__line chart__line--kpm' }));

  points.forEach((p, i) => {
    const dot = svg('circle', { cx: x(i), cy: yV(p.value), r: 3.5, class: 'chart__dot' });
    const title = svg('title');
    title.textContent = `${new Date(p.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${p.value.toLocaleString('ko-KR')}${unit} · 정확도 ${(p.accuracy * 100).toFixed(1)}%`;
    dot.append(title);
    root.append(dot);
  });

  return root;
}

function niceMax(v) {
  const step = v <= 50 ? 10 : v <= 200 ? 50 : v <= 1000 ? 100 : v <= 5000 ? 500 : 1000;
  return Math.ceil((v * 1.1) / step) * step;
}
