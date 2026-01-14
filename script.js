const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const dateHeader = document.getElementById('date-header');
const ganttBody = document.getElementById('gantt-body');
const taskEditor = document.getElementById('taskEditor');
const subtaskContainer = document.getElementById('subtaskContainer');
const subtaskInput = document.getElementById('subtaskInput');
const categoryList = document.getElementById('categoryList');

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const catColors = { 
    "Work": "#4d89ff", "Part-time": "#2ecc71", "Life": "#ff7675", 
    "Self": "#a29bfe", "Family": "#ff9f43", "Friends": "#00d2d3" 
};

let tasks = [];
let tempSubtasks = []; 
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let myPieChart = null; // Store chart instance

function init() {
    months.forEach((m, i) => monthSelect.add(new Option(m, i)));
    for (let i = 2024; i <= 2030; i++) yearSelect.add(new Option(i, i));
    monthSelect.value = new Date().getMonth();
    yearSelect.value = new Date().getFullYear();
    renderChart();
}

function updatePieChart(counts) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const labels = Object.keys(counts);
    const data = Object.values(counts);
    const colors = labels.map(label => catColors[label]);

    if (myPieChart) {
        myPieChart.destroy();
    }

    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // We use our custom legend
            },
            cutout: '70%'
        }
    });
}

function renderChart() {
    const month = parseInt(monthSelect.value);
    const year = parseInt(yearSelect.value);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    document.documentElement.style.setProperty('--days-in-month', daysInMonth);

    let headerHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(year, month, d).getDay()];
        headerHtml += `<div class="day-column-header" style="text-align:center;"><span style="color:#94a3b8; font-size:10px; display:block;">${dayName}</span><b>${d}</b></div>`;
    }
    dateHeader.innerHTML = headerHtml;

    let bodyHtml = '';
    let catCounts = { "Work": 0, "Part-time": 0, "Life": 0, "Self": 0, "Family": 0, "Friends": 0 };
    
    tasks.forEach(task => {
        const start = new Date(task.start);
        if (start.getMonth() === month && start.getFullYear() === year) {
            catCounts[task.category]++;
            const duration = Math.max(1, Math.ceil((new Date(task.end) - start) / 86400000) + 1);
            bodyHtml += `<div class="task-bar" style="grid-column: ${start.getDate()} / span ${duration}; background: ${catColors[task.category]}" onclick="editTask('${task.id}')">${task.name}</div>`;
        }
    });
    ganttBody.innerHTML = bodyHtml;

    renderTodayLine(month, year);

    // Update Category Legend and Pie Chart
    categoryList.innerHTML = Object.entries(catCounts).map(([cat, count]) => `
        <div class="category-pill">
            <span><i class="category-dot" style="background:${catColors[cat]}"></i>${cat}</span>
            <b>${count}</b>
        </div>
    `).join('');
    
    updatePieChart(catCounts);

    document.getElementById('totalStat').innerText = tasks.length;
    document.getElementById('activeStat').innerText = tasks.filter(t => t.subtasks.some(s => !s.done)).length;
    document.getElementById('doneCount').innerText = tasks.filter(t => t.subtasks.length > 0 && t.subtasks.every(s => s.done)).length;

    renderMiniCalendar();
}

// ... Keep all other functions (renderTodayLine, Subtask Handling, Panel Logic, MiniCalendar) exactly as they were ...

function renderTodayLine(m, y) {
    const now = new Date();
    if (now.getMonth() === m && now.getFullYear() === y) {
        const day = now.getDate();
        const offset = (day - 1 + (now.getHours() * 60 + now.getMinutes()) / 1440) * 80;
        const line = document.createElement('div');
        line.className = 'today-line';
        line.style.left = `${offset}px`;
        line.innerHTML = `<div class="time-label">${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}</div>`;
        ganttBody.appendChild(line);
    }
}

document.getElementById('addSubtaskBtn').onclick = () => {
    if (subtaskInput.value.trim() === "") return;
    tempSubtasks.push({ text: subtaskInput.value, done: false });
    subtaskInput.value = "";
    renderSubtaskList();
};

function renderSubtaskList() {
    subtaskContainer.innerHTML = tempSubtasks.map((s, i) => `
        <div class="subtask-item">
            <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask(${i})">
            <span class="${s.done ? 'done' : ''}">${s.text}</span>
            <span onclick="removeSubtask(${i})" style="color:red; cursor:pointer; font-weight:bold; margin-left:auto;">✕</span>
        </div>
    `).join('');
    updateDrawerStatus();
}

function toggleSubtask(index) { tempSubtasks[index].done = !tempSubtasks[index].done; renderSubtaskList(); }
function removeSubtask(index) { tempSubtasks.splice(index, 1); renderSubtaskList(); }

function updateDrawerStatus() {
    const total = tempSubtasks.length;
    const completed = tempSubtasks.filter(s => s.done).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    document.getElementById('compStat').innerText = completed;
    document.getElementById('totalStatSmall').innerText = total;
    document.getElementById('drawerProg').style.width = percent + "%";
    document.getElementById('percentLabel').innerText = percent + "% Complete";
}

document.getElementById('openModalBtn').onclick = () => { resetForm(); document.getElementById('panelTitle').innerText = "Add New Project"; taskEditor.classList.add('active'); };
document.getElementById('closeEditorBtn').onclick = () => taskEditor.classList.remove('active');

function editTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('panelTitle').innerText = "Edit Project";
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('startDate').value = task.start;
    document.getElementById('endDate').value = task.end;
    document.getElementById('taskCategory').value = task.category;
    tempSubtasks = JSON.parse(JSON.stringify(task.subtasks)); 
    renderSubtaskList();
    taskEditor.classList.add('active');
}

function resetForm() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = "";
    tempSubtasks = [];
    renderSubtaskList();
}

document.getElementById('taskForm').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const taskData = {
        id: id || Date.now().toString(),
        name: document.getElementById('taskName').value,
        category: document.getElementById('taskCategory').value,
        start: document.getElementById('startDate').value,
        end: document.getElementById('endDate').value,
        subtasks: [...tempSubtasks]
    };
    if (id) {
        const idx = tasks.findIndex(t => t.id === id);
        tasks[idx] = taskData;
    } else {
        tasks.push(taskData);
    }
    renderChart();
    taskEditor.classList.remove('active');
};

function renderMiniCalendar() {
    document.getElementById('calMonthYear').innerText = `${months[calMonth]} ${calYear}`;
    let html = ["S","M","T","W","T","F","S"].map(d => `<div style="font-size:10px; font-weight:700; color:#94a3b8; text-align:center">${d}</div>`).join('');
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = new Date().toDateString() === new Date(calYear, calMonth, d).toDateString() ? 'today' : '';
        html += `<div class="cal-date ${isToday}" style="text-align:center; padding:5px 0; font-size:11px">${d}</div>`;
    }
    document.getElementById('miniCalendar').innerHTML = html;
}

document.getElementById('prevCal').onclick = () => { calMonth--; if(calMonth < 0){calMonth=11; calYear--;} renderMiniCalendar(); };
document.getElementById('nextCal').onclick = () => { calMonth++; if(calMonth > 11){calMonth=0; calYear++;} renderMiniCalendar(); };

monthSelect.onchange = renderChart;
yearSelect.onchange = renderChart;
init();