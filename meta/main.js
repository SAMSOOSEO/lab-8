import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// ===============================
// GLOBAL VARIABLES
// ===============================
let commits = [];
let filteredCommits = [];
let svg;
let xScale, yScale, timeScale;
let commitProgress = 100;
let commitMaxTime;
let colorScale;

// ===============================
// 1. LOAD DATA
// ===============================
async function loadData() {
  return d3.csv("loc.csv", row => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    datetime: new Date(row.datetime),
    date: new Date(row.date + "T00:00" + (row.timezone || "+09:00")),
  }));
}

// ===============================
// 2. PROCESS COMMITS
// ===============================
function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const { author, datetime } = lines[0];
    return {
      id: commit,
      url: "https://github.com/SAMSOOSEO/lab-6/commit/" + commit,
      author,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
      lines,
    };
  }).sort((a, b) => a.datetime - b.datetime);
}

// ===============================
// 3. TIME SCALE FOR SLIDER + SCROLL
// ===============================
function initTimeScale(commits) {
  timeScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([0, 100]);

  commitMaxTime = timeScale.invert(commitProgress);
}

// ===============================
// 4. BUILD SCROLLAMA STEPS
// ===============================
function buildSteps(commits) {
  d3.select("#scatter-story")
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class", "step")
    .style("padding-bottom", "20vh")
    .each((d, i, nodes) => nodes[i].__data__ = d) // 데이터 바인딩
    .html(d => `
      On ${d.datetime.toLocaleString('en', { dateStyle:'full', timeStyle:'short' })}, 
      I made <a href="${d.url}" target="_blank">a glorious commit</a>.
      I edited ${d.totalLines} lines across ${
        d3.rollups(d.lines, v => v.length, d => d.file).length
      } files.
    `);
}

// ===============================
// 5. SCATTER PLOT
// ===============================
function renderScatterPlot(commits) {
  const width = 1500, height = 400;
  const margin = { top: 10, right: 10, bottom: 50, left: 60 };
  const usable = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  svg = d3.select("#chart").html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usable.left, usable.right]);

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  const rScale = d3.scaleSqrt()
    .domain(d3.extent(commits, d => d.totalLines))
    .range([2, 30]);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${usable.bottom})`)
    .attr("class", "x-axis")
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(${usable.left},0)`)
    .attr("class", "y-axis")
    .call(d3.axisLeft(yScale));

  // grid
  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usable.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usable.width))
    .selectAll("line").attr("stroke","#ccc").attr("stroke-dasharray","2,2");

  // dots
  svg.append("g").attr("class","dots")
    .selectAll("circle")
    .data(commits, d=>d.id)
    .join("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("fill-opacity", 0.7);

  // brush
  const brush = d3.brush()
    .extent([[usable.left, usable.top],[usable.right, usable.bottom]])
    .on("start brush end", event => {
      const selection = event.selection;
      if(!selection) return updateSelection([], []);
      
      const [[x0,y0],[x1,y1]] = selection;
      const selectedCommits = commits.filter(d => {
        const cx = xScale(d.datetime), cy = yScale(d.hourFrac);
        return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
      });
      svg.selectAll("circle").classed("selected", d => selectedCommits.includes(d));
      updateSelection(selectedCommits);
    });

  svg.append("g").attr("class","brush").call(brush);
}

// ===============================
// 6. UPDATE SCATTER
// ===============================
function updateScatter(commitsToShow) {
  const dots = svg.select(".dots")
    .selectAll("circle")
    .data(commitsToShow, d => d.id);

  const rScale = d3.scaleSqrt()
    .domain(d3.extent(commits, d => d.totalLines))
    .range([2, 30]);

  dots.join(
    enter => enter.append("circle")
      .attr("cx", d => xScale(d.datetime))
      .attr("cy", d => yScale(d.hourFrac))
      .attr("r", d => rScale(d.totalLines))
      .attr("fill", "steelblue")
      .style("opacity", 0.7),
    update => update
      .attr("cx", d => xScale(d.datetime))
      .attr("cy", d => yScale(d.hourFrac))
      .attr("r", d => rScale(d.totalLines))
  );
}

// ===============================
// 7. UPDATE FILE UNIT VISUALIZATION
// ===============================
function updateFileDisplay(commitsToShow) {
  let lines = commitsToShow.flatMap(d => d.lines);
  let files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a,b)=> b.lines.length - a.lines.length);

  colorScale = d3.scaleOrdinal(d3.schemeTableau10);

  let filesContainer = d3.select('#files')
    .selectAll('div')
    .data(files, d => d.name)
    .join(
      enter => enter.append('div').call(div => {
        div.append('dt').append('code');
        div.append('dd');
      })
    );

  filesContainer.select('dt > code')
    .html(d => `${d.name} <small>${d.lines.length} lines</small>`);

  filesContainer.select('dd')
    .selectAll('div.loc')
    .data(d => d.lines)
    .join('div')
    .attr('class','loc')
    .attr('style', d => `--color: ${colorScale(d.type)}`);
}

// ===============================
// 8. SLIDER EVENT
// ===============================
function onTimeSlider(commits) {
  const slider = document.getElementById("commit-progress");
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  updateScatter(filteredCommits);
  updateFileDisplay(filteredCommits);

  d3.select("#commit-display-time").text(commitMaxTime.toLocaleString("ko-KR"));
}

// ===============================
// 9. SCROLLAMA
// ===============================
function initScrollama(commits) {
  const scroller = scrollama();
  scroller.setup({
    container: "#scrolly-1",
    step: "#scrolly-1 .step",
    offset: 0.5
  }).onStepEnter(res => {
    const commit = res.element.__data__;
    const current = commits.filter(d => d.datetime <= commit.datetime);

    updateScatter(current);
    updateFileDisplay(current);

    d3.select("#commit-display-time")
      .text(commit.datetime.toLocaleString("ko-KR"));
  });
}

// ===============================
// 10. SELECTION UPDATE
// ===============================
function updateSelection(selectedCommits) {
  d3.select("#selection-count")
    .text(`${selectedCommits.length} commits selected` || "No commits selected");

  const container = d3.select("#language-breakdown");
  container.html('');
  const lines = selectedCommits.flatMap(d => d.lines);
  const breakdown = Array.from(d3.rollup(lines, v => v.length, d => d.type))
    .sort((a,b)=>b[1]-a[1]);

  const cards = container.selectAll("div.lang-card")
    .data(breakdown)
    .join("div")
    .attr("class","lang-card");

  cards.append("div").attr("class","lang-name").text(d=>d[0]);
  cards.append("div").attr("class","lang-count")
    .text(d=>`${d[1]} lines (${d3.format(".1~%")(d[1]/lines.length)})`);
}

// ===============================
// 11. MAIN
// ===============================
(async function () {
  const data = await loadData();
  commits = processCommits(data);
  filteredCommits = commits;

  initTimeScale(commits);
  buildSteps(commits);
  renderScatterPlot(commits);
  updateScatter(commits);
  updateFileDisplay(commits);
  initScrollama(commits);

  document.getElementById("commit-progress")
    .addEventListener("input", () => onTimeSlider(commits));
})();
