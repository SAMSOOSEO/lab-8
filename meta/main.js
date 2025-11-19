import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ---------------------------
// 1. 데이터 로드
// ---------------------------
async function loadData() {
  const data = await d3.csv('loc.csv', row => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + (row.timezone || '+09:00')),
    datetime: new Date(row.datetime)
  }));
  return data;
}

// ---------------------------
// 2. 커밋 가공
// ---------------------------
function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const { author, datetime } = lines[0];
    return {
      id: commit,
      url: 'https://github.com/SAMSOOSEO/lab-6/commit/' + commit,
      author,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
      lines
    };
  });
}

// ---------------------------
// 3. 슬라이더용 시간 스케일
// ---------------------------
let commitProgress = 100;
let commitMaxTime;
let timeScale;
let xScale;
let yScale;

function initTimeScale(commits) {
  timeScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([0, 100]);
  commitMaxTime = timeScale.invert(commitProgress);
}

// ---------------------------
// 4. 필터링 변수
// ---------------------------
let filteredCommits;

// ---------------------------
// 5. 슬라이더 이벤트
// ---------------------------
function onTimeSliderChange(data, commits) {
  const slider = document.getElementById("commit-progress");
  const timeEl = document.getElementById("commit-display-time");

  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  if (timeEl) {
    timeEl.textContent = commitMaxTime.toLocaleString("ko-KR", {
      dateStyle: "long",
      timeStyle: "short",
    });
  }

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  updateScatterPlot(filteredCommits);
  renderCommitInfo(data, filteredCommits);
  updateFileDisplay(filteredCommits); // <- unit viz 업데이트
}


// ---------------------------
// 6. scatter plot 렌더링
// ---------------------------
function renderScatterPlot(commits) {
  const width = 1500, height = 600;
  const margin = { top: 10, right: 10, bottom: 50, left: 60 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };

  const svg = d3.select("#chart").html("").append("svg")
    .attr("width", width)
    .attr("height", height);

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usableArea.left, usableArea.right]);

  yScale = d3.scaleLinear().domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${usableArea.bottom})`)
    .attr("class", "x-axis")
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(${usableArea.left},0)`)
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale).tickFormat(d => String(d).padStart(2,'0')+":00"));

  // grid
  svg.append("g")
    .attr("class","gridlines")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width))
    .selectAll("line").attr("stroke","#ccc").attr("stroke-dasharray","2,2");

  // dots
  const dots = svg.append("g").attr("class","dots")
    .selectAll("circle")
    .data(commits, d => d.id)
    .join(enter => enter.append("circle")
      .attr("cx", d => xScale(d.datetime))
      .attr("cy", d => yScale(d.hourFrac))
      .attr("r", 0) // entry animation 시작값
      .style("--r", d => rScale(d.totalLines))
      .attr("fill","steelblue")
      .style("fill-opacity",0.7)
      .transition()
      .duration(200)
      .attr("r", d => rScale(d.totalLines)),
      update => update
        .attr("cx", d => xScale(d.datetime))
        .attr("cy", d => yScale(d.hourFrac))
        .attr("r", d => rScale(d.totalLines))
        .style("--r", d => rScale(d.totalLines))
    )
    .on("mouseenter",(event,d)=>{
      d3.select(event.currentTarget).style("fill-opacity",1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave",()=>updateTooltipVisibility(false));

  // brush
  const brush = d3.brush()
    .extent([[usableArea.left, usableArea.top],[usableArea.right, usableArea.bottom]])
    .on("start brush end", event => {
      const selection = event.selection;
      dots.classed("selected", d => isCommitSelected(selection,d));
      const selectedCommits = filteredCommits.filter(d => isCommitSelected(selection,d));
      document.querySelector("#selection-count").textContent = `${selectedCommits.length || 'No'} commits selected`;

      // language breakdown
      const container = d3.select("#language-breakdown");
      container.html('');
      const lines = selectedCommits.flatMap(d=>d.lines);
      const breakdown = Array.from(d3.rollup(lines,v=>v.length,d=>d.type)).sort((a,b)=>b[1]-a[1]);
      const cards = container.selectAll("div.lang-card").data(breakdown).join("div").attr("class","lang-card");
      cards.append("div").attr("class","lang-name").text(d=>d[0]);
      cards.append("div").attr("class","lang-count").text(d=>`${d[1]} lines (${d3.format(".1~%")(d[1]/lines.length)})`);
    });

  svg.append("g").attr("class","brush").call(brush);
}

// ---------------------------
// 7. scatter plot 업데이트
// ---------------------------
function updateScatterPlot(commits) {
  const svg = d3.select("#chart svg");
  const dots = svg.select("g.dots");
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines,maxLines]).range([2,30]);
  xScale.domain(d3.extent(commits, d=>d.datetime));
  svg.select("g.x-axis").call(d3.axisBottom(xScale));

  dots.selectAll("circle")
    .data(commits, d => d.id)
    .join(enter => enter.append("circle")
      .attr("cx", d => xScale(d.datetime))
      .attr("cy", d => yScale(d.hourFrac))
      .attr("r",0)
      .style("--r", d => rScale(d.totalLines))
      .attr("fill","steelblue")
      .style("fill-opacity",0.7)
      .transition()
      .duration(200)
      .attr("r", d => rScale(d.totalLines)),
      update => update
        .attr("cx", d => xScale(d.datetime))
        .attr("cy", d => yScale(d.hourFrac))
        .attr("r", d => rScale(d.totalLines))
        .style("--r", d => rScale(d.totalLines))
    )
    .on("mouseenter",(event,d)=>{
      d3.select(event.currentTarget).style("fill-opacity",1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on("mouseleave",()=>updateTooltipVisibility(false));
}

// ---------------------------
// 8. Tooltip
// ---------------------------
function renderTooltipContent(commit) {
  if (!commit) return;
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime.toLocaleDateString('ko-KR');
  document.getElementById('commit-time').textContent = commit.datetime.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}
function updateTooltipVisibility(show){document.getElementById('commit-tooltip').hidden=!show;}
function updateTooltipPosition(event){
  const t=document.getElementById('commit-tooltip');
  t.style.left=`${event.pageX+10}px`;
  t.style.top=`${event.pageY+10}px`;
}

// ---------------------------
// 9. Commit info
// ---------------------------
function renderCommitInfo(data, commits){
  const dl=d3.select('#stats').html('').append('dl').attr('class','stats');
  const stats=[
    {label:'Total LOC', value:data.length},
    {label:'Total commits', value:commits.length},
    {label:'Number of files', value:d3.groups(data,d=>d.file).length},
    {label:'Maximum depth', value:d3.max(data,d=>d.depth)},
    {label:'Longest line', value:d3.max(data,d=>d.length)},
    {label:'Average line length', value:d3.mean(data,d=>d.length).toFixed(1)}
  ];
  const cards=dl.selectAll('div.stat-card').data(stats).join('div').attr('class','stat-card');
  cards.append('dt').text(d=>d.label);
  cards.append('dd').text(d=>d.value);
}

// ---------------------------
// 10. Brush 선택 체크
// ---------------------------
function isCommitSelected(selection, commit){
  if(!selection) return false;
  const [[x0,y0],[x1,y1]]=selection;
  const cx=xScale(commit.datetime), cy=yScale(commit.hourFrac);
  return x0<=cx && cx<=x1 && y0<=cy && cy<=y1;
}

// ---------------------------
// 11. 초기 실행
// ---------------------------
(async function(){
  const data=await loadData();
  const commits=processCommits(data);
  initTimeScale(commits);
  filteredCommits=commits;
  renderScatterPlot(filteredCommits);
  renderCommitInfo(data, filteredCommits);
  document.getElementById("commit-progress").addEventListener("input",()=>onTimeSliderChange(data, commits));
  onTimeSliderChange(data, commits);
})();

function updateFileDisplay(filteredCommits) {
  // 모든 커밋에서 라인 정보 수집
  let lines = filteredCommits.flatMap(d => d.lines);

  // 파일별로 그룹화 후 라인 수 기준 내림차순 정렬
  let files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  // 기술별 색상 스케일
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  // <dl> 업데이트
  let filesContainer = d3.select('#files')
    .selectAll('div')
    .data(files, d => d.name)
    .join(
      enter => enter.append('div').call(div => {
        div.append('dt').append('code');
        div.append('dd');
      }),
      update => update,
      exit => exit.remove()
    );

  // 파일 이름 + 라인 수
  filesContainer.select('dt > code')
    .html(d => `${d.name}<small>${d.lines.length} lines</small>`);

  // 각 라인에 대해 div.loc 생성
  filesContainer.select('dd')
    .selectAll('div.loc')
    .data(d => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', d => `--color: ${colors(d.type)}`);
}


// commits 배열이 준비된 후
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => `
    On ${d.datetime.toLocaleString('en', { dateStyle:'full', timeStyle:'short' })},
    I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
    I edited ${d.totalLines} lines across ${
      d3.rollups(d.lines, v => v.length, d => d.file).length
    } files.
    Then I looked over all I had made, and I saw that it was very good.
  `);

  