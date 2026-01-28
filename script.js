import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let tasks = [];
let tempSubtasks = []; 
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let myPieChart = null;

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const catColors = { "Work": "#4d89ff", "Part-time": "#2ecc71", "Life": "#ff7675", "Self": "#a29bfe", "Family": "#ff9f43", "Friends": "#00d2d3" };

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('authOverlay').style.display = 'none';
        initSelectors();
        loadTasks();
    } else {
        document.getElementById('authOverlay').style.display = 'flex';
    }
});

async function loadTasks() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "tasks"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderChart();
}

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

function renderChart() {
    const month = parseInt(document.getElementById('monthSelect').value);
    const year = parseInt(document.getElementById('yearSelect').value);
    const viewStart = new Date(year, month, 1);
    const viewEnd = new Date(year, month + 1, 0);
    const daysInMonth = viewEnd.getDate();
    document.documentElement.style.setProperty('--days-in-month', daysInMonth);

    let headerHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(year, month, d).getDay()];
        headerHtml += `<div class="day-column-header"><span>${dayName}</span><b>${d}</b></div>`;
    }
    document.getElementById('date-header').innerHTML = headerHtml;

    // Today Red Line Logic
    const today = new Date();
    let lineHtml = '';
    if (today.getMonth() === month && today.getFullYear() === year) {
        lineHtml = `<div class="today-marker" style="grid-column: ${today.getDate()};"></div>`;
    }

    let bodyHtml = lineHtml;
    let counts = { "Work": 0, "Part-time": 0, "Life": 0, "Self": 0, "Family": 0, "Friends": 0 };
    
    tasks.forEach(t => {
        const tStart = new Date(t.start);
        const tEnd = new Date(t.end);

        if (tStart <= viewEnd && tEnd >= viewStart) {
            if (counts.hasOwnProperty(t.category)) counts[t.category]++;
            
            const isLC = tStart < viewStart;
            const isRC = tEnd > viewEnd;
            const startPos = isLC ? 1 : tStart.getDate();
            const endPos = isRC ? daysInMonth : tEnd.getDate();
            const dur = (endPos - startPos) + 1;

            const total = t.subtasks ? t.subtasks.length : 0;
            const done = t.subtasks ? t.subtasks.filter(s => s.done).length : 0;
            const progress = total > 0 ? (done / total) * 100 : 0;
            const fullyDone = total > 0 && total === done;

            bodyHtml += `
                <div class="task-bar ${isLC ? 'clipped-left' : ''} ${isRC ? 'clipped-right' : ''}" 
                     style="grid-column: ${startPos} / span ${dur}; background: ${catColors[t.category]}44" data-id="${t.id}">
                    <div class="task-progress-fill" style="width: ${progress}%; background: ${catColors[t.category]}"></div>
                    <div class="task-inner-content">
                        ${isLC ? '<span class="arrow-glyph">⇠</span>' : ''}
                        <span class="task-name-span">${t.name}</span>
                        <div style="display:flex; align-items:center; gap:5px;">
                            ${fullyDone ? '<span class="checkmark-icon">✓</span>' : ''}
                            ${isRC ? '<span class="arrow-glyph">⇢</span>' : ''}
                        </div>
                    </div>
                </div>`;
        }
    });
    document.getElementById('gantt-body').innerHTML = bodyHtml;

    document.querySelectorAll('.task-bar').forEach(bar => {
        bar.onclick = () => editTask(bar.getAttribute('data-id'));
    });
    
    updatePieChart(counts);
    updateDashboardStats();
    renderMiniCalendar();
}

window.editTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    document.getElementById('panelTitle').innerText = "Project Details";
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
            <span class="${s.done ? 'done' : ''}">${s.text}</span>
            <span onclick="removeSub(${i})" class="remove-btn">✕</span>
        </div>
    `).join('');
}

window.toggleSub = (i) => { tempSubtasks[i].done = !tempSubtasks[i].done; renderSubtaskList(); };
window.removeSub = (i) => { tempSubtasks.splice(i, 1); renderSubtaskList(); };

document.getElementById('addSubtaskBtn').onclick = () => {
    const val = document.getElementById('subtaskInput').value;
    if (!val) return;
    tempSubtasks.push({ text: val, done: false });
    document.getElementById('subtaskInput').value = "";
    renderSubtaskList();
};

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
    await loadTasks();
};

document.getElementById('deleteTaskBtn').onclick = async () => {
    const id = document.getElementById('taskId').value;
    if (id && confirm("Are you sure you want to delete this project?")) {
        await deleteDoc(doc(db, "tasks", id));
        document.getElementById('taskEditor').classList.remove('active');
        await loadTasks();
    }
};

function updateDashboardStats() {
    document.getElementById('totalStat').innerText = tasks.length;
    document.getElementById('activeStat').innerText = tasks.filter(t => t.subtasks && t.subtasks.some(s => !s.done)).length;
    document.getElementById('doneCount').innerText = tasks.filter(t => t.subtasks && t.subtasks.length > 0 && t.subtasks.every(s => s.done)).length;
}

function updatePieChart(counts) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    if (myPieChart) myPieChart.destroy();
    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{ data: Object.values(counts), backgroundColor: Object.values(catColors), borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '75%' }
    });
    document.getElementById('categoryList').innerHTML = Object.entries(counts).map(([cat, count]) => `
        <div class="category-pill">
            <span><i class="category-dot" style="background:${catColors[cat]}"></i>${cat}</span>
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

document.getElementById('openModalBtn').onclick = () => { 
    document.getElementById('taskForm').reset(); 
    document.getElementById('taskId').value = ""; 
    document.getElementById('panelTitle').innerText = "Project Details";
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
