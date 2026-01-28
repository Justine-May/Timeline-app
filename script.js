import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAFtu27m81jshmtbEAT5Z8Uy5nsEZX5RaE",
  authDomain: "gantt-chart-23147.firebaseapp.com",
  projectId: "gantt-chart-23147",
  storageBucket: "gantt-chart-23147.firebasestorage.app",
  messagingSenderId: "173532906920",
  appId: "1:173532906920:web:7f02150d5886a74d9e899d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State Management ---
let tasks = [];
let tempSubtasks = []; 
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let myPieChart = null;

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const catColors = { 
    "Work": "#4d89ff", 
    "Part-time": "#10b981", 
    "Life": "#ff7675", 
    "Self": "#8b5cf6", 
    "Family": "#f59e0b", 
    "Friends": "#06b6d4"
};

// --- Auth Observer ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('authOverlay').style.display = 'none';
        initSelectors();
        loadTasks();
    } else {
        document.getElementById('authOverlay').style.display = 'flex';
    }
});

// --- Data Fetching ---
async function loadTasks() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "tasks"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderChart();
}

// --- UI Initialization ---
function initSelectors() {
    const mSel = document.getElementById('monthSelect');
    const ySel = document.getElementById('yearSelect');
    if (mSel.options.length === 0) {
        months.forEach((m, i) => mSel.add(new Option(m, i)));
        for (let i = 2024; i <= 2030; i++) ySel.add(new Option(i, i));
        mSel.value = new Date().getMonth();
        ySel.value = new Date().getFullYear();
    }
}

// --- Core Rendering Logic ---
function renderChart() {
    const month = parseInt(document.getElementById('monthSelect').value);
    const year = parseInt(document.getElementById('yearSelect').value);
    
    const viewStart = new Date(year, month, 1);
    const viewEnd = new Date(year, month + 1, 0);
    const daysInMonth = viewEnd.getDate();
    
    document.documentElement.style.setProperty('--days-in-month', daysInMonth);

    // 1. Render Date Header
    let headerHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dateObj.getDay()];
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
        headerHtml += `
            <div class="day-column-header" style="${isWeekend ? 'background: #f8fafc' : ''}">
                <span>${dayName}</span>
                <b>${d}</b>
            </div>`;
    }
    document.getElementById('date-header').innerHTML = headerHtml;

    // 2. Filter & Render Tasks
    let bodyHtml = '';
    let counts = { "Work": 0, "Part-time": 0, "Life": 0, "Self": 0, "Family": 0, "Friends": 0 };
    
    const visibleTasks = tasks.filter(t => {
        const tStart = new Date(t.start);
        const tEnd = new Date(t.end);
        return tStart <= viewEnd && tEnd >= viewStart;
    });

    // Handle Empty State
    const emptyState = document.getElementById('empty-state');
    if (visibleTasks.length === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
        visibleTasks.forEach(t => {
            if (counts[t.category] !== undefined) counts[t.category]++;
            
            const tStart = new Date(t.start);
            const tEnd = new Date(t.end);
            const startPos = tStart < viewStart ? 1 : tStart.getDate();
            const endPos = tEnd > viewEnd ? daysInMonth : tEnd.getDate();
            const dur = (endPos - startPos) + 1;

            const done = t.subtasks ? t.subtasks.filter(s => s.done).length : 0;
            const total = t.subtasks ? t.subtasks.length : 0;
            const progress = total > 0 ? (done / total) * 100 : 0;
            const color = catColors[t.category] || "#94a3b8";

            bodyHtml += `
                <div class="task-bar" style="grid-column: ${startPos} / span ${dur}; background: ${color}15" data-id="${t.id}">
                    <div class="task-progress-fill" style="width: ${progress}%; background: ${color}"></div>
                    <div class="task-content">
                        <span class="task-name-label">${t.name}</span>
                        ${progress === 100 ? '<span class="check-badge">✓</span>' : ''}
                    </div>
                </div>`;
        });
    }
    document.getElementById('gantt-body').innerHTML += bodyHtml;

    // Event Delegation for Task Clicks
    document.querySelectorAll('.task-bar').forEach(bar => {
        bar.onclick = () => window.editTask(bar.getAttribute('data-id'));
    });
    
    updatePieChart(counts);
    updateDashboardStats();
    renderMiniCalendar();
}

// --- Task Editing ---
window.editTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('panelTitle').innerText = "Edit Project";
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name;
    document.getElementById('startDate').value = task.start;
    document.getElementById('endDate').value = task.end;
    document.getElementById('taskCategory').value = task.category;
    document.getElementById('deleteTaskBtn').style.display = "block";
    tempSubtasks = task.subtasks ? [...task.subtasks] : [];
    renderSubtaskList();
    document.getElementById('taskEditor').classList.add('active');
};

function renderSubtaskList() {
    document.getElementById('subtaskContainer').innerHTML = tempSubtasks.map((s, i) => `
        <div class="subtask-item">
            <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSub(${i})">
            <span style="${s.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${s.text}</span>
            <span onclick="removeSub(${i})" class="remove-sub-btn">✕</span>
        </div>
    `).join('');
}

window.toggleSub = (i) => { tempSubtasks[i].done = !tempSubtasks[i].done; renderSubtaskList(); };
window.removeSub = (i) => { tempSubtasks.splice(i, 1); renderSubtaskList(); };

document.getElementById('addSubtaskBtn').onclick = () => {
    const input = document.getElementById('subtaskInput');
    if (!input.value) return;
    tempSubtasks.push({ text: input.value, done: false });
    input.value = "";
    renderSubtaskList();
};

// --- Form Submission ---
document.getElementById('taskForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const data = {
        userId: auth.currentUser.uid,
        name: document.getElementById('taskName').value,
        category: document.getElementById('taskCategory').value,
        start: document.getElementById('startDate').value,
        end: document.getElementById('endDate').value,
        subtasks: [...tempSubtasks]
    };

    if (id) await updateDoc(doc(db, "tasks", id), data);
    else await addDoc(collection(db, "tasks"), data);
    
    document.getElementById('taskEditor').classList.remove('active');
    loadTasks();
};

document.getElementById('deleteTaskBtn').onclick = async () => {
    const id = document.getElementById('taskId').value;
    if (id && confirm("Are you sure you want to delete this project?")) {
        await deleteDoc(doc(db, "tasks", id));
        document.getElementById('taskEditor').classList.remove('active');
        loadTasks();
    }
};

// --- Analytics & Widgets ---
function updateDashboardStats() {
    document.getElementById('totalStat').innerText = tasks.length;
    document.getElementById('activeStat').innerText = tasks.filter(t => t.subtasks?.some(s => !s.done)).length;
    document.getElementById('doneCount').innerText = tasks.filter(t => t.subtasks?.length > 0 && t.subtasks.every(s => s.done)).length;
}

function updatePieChart(counts) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (myPieChart) myPieChart.destroy();
    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{ 
                data: Object.values(counts), 
                backgroundColor: Object.values(catColors), 
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            cutout: '80%' 
        }
    });
    
    document.getElementById('categoryList').innerHTML = Object.entries(counts).map(([cat, count]) => `
        <div class="category-pill">
            <span><i style="background:${catColors[cat]}"></i>${cat}</span>
            <b>${count}</b>
        </div>
    `).join('');
}

function renderMiniCalendar() {
    document.getElementById('calMonthYear').innerText = `${months[calMonth]} ${calYear}`;
    let html = ["S","M","T","W","T","F","S"].map(d => `<div class="cal-day-label">${d}</div>`).join('');
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    
    for (let i = 0; i < firstDay; i++) html += `<div></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = new Date().toDateString() === new Date(calYear, calMonth, d).toDateString() ? 'today' : '';
        html += `<div class="cal-date ${isToday}">${d}</div>`;
    }
    document.getElementById('miniCalendar').innerHTML = html;
}

// --- Global UI Listeners ---
document.getElementById('openModalBtn').onclick = () => { 
    document.getElementById('taskForm').reset(); 
    document.getElementById('taskId').value = ""; 
    document.getElementById('panelTitle').innerText = "New Project";
    document.getElementById('deleteTaskBtn').style.display = "none";
    tempSubtasks = []; 
    renderSubtaskList(); 
    document.getElementById('taskEditor').classList.add('active'); 
};

document.getElementById('closeEditorBtn').onclick = () => document.getElementById('taskEditor').classList.remove('active');
document.getElementById('loginBtn').onclick = () => signInWithEmailAndPassword(auth, document.getElementById('authEmail').value, document.getElementById('authPassword').value).catch(e => alert(e.message));
document.getElementById('signupBtn').onclick = () => createUserWithEmailAndPassword(auth, document.getElementById('authEmail').value, document.getElementById('authPassword').value).catch(e => alert(e.message));
document.getElementById('logoutBtn').onclick = () => signOut(auth);

document.getElementById('prevCal').onclick = () => { calMonth--; if(calMonth < 0){calMonth=11; calYear--;} renderMiniCalendar(); };
document.getElementById('nextCal').onclick = () => { calMonth++; if(calMonth > 11){calMonth=0; calYear++;} renderMiniCalendar(); };
document.getElementById('monthSelect').onchange = renderChart;
document.getElementById('yearSelect').onchange = renderChart;
