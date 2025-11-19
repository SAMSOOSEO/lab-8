import { fetchJSON, renderProjects } from './global.js';

(async function() {
  const projectsContainer = document.querySelector('.projects');
  const projects = await fetchJSON('lib/projects.json');
  const latestProjects = projects.slice(0, 4);
  renderProjects(latestProjects, projectsContainer, 'h3');


  const githubData = await fetchJSON('https://api.github.com/users/SAMSOOSEO');
  console.log(githubData); // 확인용

  const profileStats = document.querySelector('#profile-stats');


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

const projectsContainer = document.querySelector('.projects');


