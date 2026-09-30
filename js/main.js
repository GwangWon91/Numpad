// 앱 시작점: 해시 라우터
const app = document.getElementById('app');

const routes = {
  '/': () => {
    app.innerHTML = '<h1>Numpad Dojo</h1><p>넘패드, 보지 않고 빠르게.</p>';
  },
};

function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const route = routes[path] ?? routes['/'];
  route();
}

window.addEventListener('hashchange', render);
render();
