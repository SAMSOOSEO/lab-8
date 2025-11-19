import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log('IT’S ALIVE!');

// 선택자 $$ 함수   (배열 반환)
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// 페이지 정보 배열
const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'CV & Resume' },
  { url: 'meta/', title: 'meta' },
  { url: 'https://github.com/samsooseo', title: 'GitHub' }
];

// <nav> 생성 후 body 맨 위에 추가
let nav = document.createElement('nav');
document.body.prepend(nav);

// BASE_PATH 정의 (로컬 / GitHub Pages 구분)
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'             // 로컬 서버
    : '/lab-8/';      // GitHub Pages repo 이름

// 페이지 링크 반복 생성
for (let p of pages) {
  // 상대 경로 처리
  let url = !p.url.startsWith('http') ? BASE_PATH + p.url : p.url;

  // <a> 요소 생성
  let a = document.createElement('a');
  a.href = url;
  a.textContent = p.title;

  // 현재 페이지면 current 클래스 추가
  a.classList.toggle('current', a.host === location.host && a.pathname === location.pathname);

  // 외부 링크는 새 탭으로 열기 + 보안 옵션
  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  // nav에 추가
  nav.append(a);
}

// 모든 nav 링크 배열 확인 (선택적)
const navLinks = $$("nav a");
console.log(navLinks);


// Dark Mode 관련 내용//

document.body.insertAdjacentHTML(
  'afterbegin',
  `
<label class="color-scheme">
  Theme:
  <select>
    <option value="light dark">Automatic</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
</label>
`
);
// select 요소 가져오는 코드
const select = document.querySelector('.color-scheme select');

// 페이지 로드 시 localStorage 값 적용 코드
if ('colorScheme' in localStorage) {
  const saved = localStorage.colorScheme;
  document.documentElement.style.setProperty('color-scheme', saved);
  select.value = saved;
  console.log('loaded color scheme from localStorage:', saved);
}

select.addEventListener('input', (event) => {
  const value = event.target.value;
  if (value === 'light dark') {
    document.documentElement.style.removeProperty('color-scheme'); // 자동 OS 모드
  } else {
    document.documentElement.style.setProperty('color-scheme', value); // light/dark
  }
  localStorage.colorScheme = value; // 여기서 저장
});

const saved = localStorage.colorScheme || 'light dark'; // 저장된 값 없으면 자동
document.documentElement.style.setProperty(
  'color-scheme',
  saved === 'light dark' ? '' : saved
);
select.value = saved;

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

// 프로젝트 데이터를 가져와서 자동 렌더링하는 함수
export async function initProjects() {
  const projects = await fetchJSON(`${BASE_PATH}lib/projects.json`);
  const container = document.querySelector('.projects');
  container.innerHTML = '';
  projects.forEach(project => {
    const article = document.createElement('article');
    article.innerHTML = `
      <h3>${project.title}</h3>
      <img src="${project.image || 'https://via.placeholder.com/150'}" alt="${project.title}">
      <p>${project.description || 'Description not available.'}</p>
    `;
    container.appendChild(article);
  });
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!containerElement) {
    console.error('renderProjects: container element not found.');
    return;
  }

  // 유효한 headingLevel인지 확인
  const validHeadings = ['h1','h2','h3','h4','h5','h6'];
  if (!validHeadings.includes(headingLevel)) {
    console.warn(`Invalid headingLevel "${headingLevel}", defaulting to h2`);
    headingLevel = 'h2';
  }

  // 기존 콘텐츠 제거
  containerElement.innerHTML = '';

  // 프로젝트 반복
  projects.forEach(project => {
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${project.title || 'No Title'}</${headingLevel}>
      <img src="${project.image || 'https://via.placeholder.com/150'}" alt="${project.title || 'No Title'}">
      <div class="project-text">
        <p>${project.description || 'Description not available.'}</p>
        <p class="project-year">${project.year || 'Year N/A'}</p>
      </div>
    `;
    containerElement.appendChild(article);
  });
}

/* 여기까지는 문제 없음 */


export async function fetchGitHubData(samsooseo) {
  try {
    const response = await fetch(`https://api.github.com/users/${samsooseo}/repos`);
    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub repos: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data; // GitHub repos 배열 반환
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    return []; // 에러 발생 시 빈 배열 반환
  }
}




(async function() {
  // 프로젝트 렌더링
  const projectsContainer = document.querySelector('.projects');
  const projects = await fetchJSON(`${BASE_PATH}lib/projects.json`);
  const latestProjects = projects.slice(0, 4);
  renderProjects(latestProjects, projectsContainer, 'h3');
  

  // GitHub 사용자 정보 가져오기
  const githubData = await fetchJSON('https://api.github.com/users/SAMSOOSEO');
  console.log(githubData);

  // HTML container 선택
  const profileStats = document.querySelector('#profile-stats');

  // 데이터 동적으로 삽입 (grid 순서: Followers, Following, Public Repos, Public Gists)
  if (profileStats) {
    profileStats.innerHTML = `
      <dl>
        <dt>Followers:</dt><dd>${githubData.followers}</dd>
        <dt>Following:</dt><dd>${githubData.following}</dd>
        <dt>Public Repos:</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists:</dt><dd>${githubData.public_gists}</dd>
      </dl>
    `;
  }
})();

let selectedIndex = -1;

d3.select('svg').selectAll('path')
  .on('click', (_, i) => {
    selectedIndex = selectedIndex === i ? -1 : i;

    // 파이 조각 업데이트
    d3.select('svg').selectAll('path')
      .attr('class', (_, idx) => idx === selectedIndex ? 'selected' : '');

    // 범례 업데이트
    d3.select('.legend').selectAll('li')
      .attr('class', (_, idx) => idx === selectedIndex ? 'selected' : '');
  });