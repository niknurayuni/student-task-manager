
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxfm4e5m7oGMuYVn2QU0xWGAutVxCizP8",
  authDomain: "student-task-manager-867c7.firebaseapp.com",
  projectId: "student-task-manager-867c7",
  storageBucket: "student-task-manager-867c7.firebasestorage.app",
  messagingSenderId: "775588555066",
  appId: "1:775588555066:web:68dd3ee10ff4b8303e8803"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// HTML elements
const taskForm = document.getElementById("taskForm");
const taskContainer = document.getElementById("taskContainer");
const taskFilter = document.getElementById("taskFilter");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

let tasks = [];
let currentUser = null;

// Google Sign-In
loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Login error:", error);
    alert("Google Sign-In failed: " + error.message);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    alert("Unable to sign out.");
  }
});

// Monitor authentication
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  tasks = [];
  displayTasks();

  if (user) {
    userInfo.textContent =
      "Welcome, " + (user.displayName || user.email);

    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    taskForm.hidden = false;
    taskFilter.disabled = false;

    await loadTasks(user.uid);
  } else {
    userInfo.textContent = "Please sign in to manage tasks.";

    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    taskForm.hidden = true;
    taskFilter.disabled = true;
  }
});

// Load only the signed-in user's tasks
async function loadTasks(uid) {
  try {
    const q = query(
      collection(db, "tasks"),
      where("userId", "==", uid)
    );

    const snapshot = await getDocs(q);

    // Prevent an old request from replacing another user's data
    if (auth.currentUser?.uid !== uid) return;

    tasks = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    displayTasks();
  } catch (error) {
    console.error("Error loading tasks:", error);
    alert("Unable to load tasks: " + error.message);
  }
}

// Update dashboard statistics
function updateDashboard() {
  document.getElementById("totalTasks").textContent =
    tasks.length;

  document.getElementById("pendingTasks").textContent =
    tasks.filter(t => t.status === "pending").length;

  document.getElementById("completedTasks").textContent =
    tasks.filter(t => t.status === "completed").length;
}

// Display tasks
function displayTasks() {
  taskContainer.innerHTML = "";

  const filter = taskFilter.value;
  const filtered = tasks.filter(task =>
    filter === "all" || task.status === filter
  );

  if (filtered.length === 0) {
    const message = document.createElement("p");
    message.textContent = "No tasks available.";
    taskContainer.appendChild(message);
  }

  filtered.forEach(task => {
    const item = document.createElement("div");
    item.className = "task-item";

    const title = document.createElement("h3");
    title.textContent = task.title;

    const description = document.createElement("p");
    description.textContent = task.description || "";

    const deadline = document.createElement("p");
    deadline.textContent = "Deadline: " + task.deadline;

    const status = document.createElement("p");
    status.textContent = "Status: " + task.status;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const statusSelect = document.createElement("select");

    ["pending", "in-progress", "completed"].forEach(value => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = task.status === value;
      statusSelect.appendChild(option);
    });

    statusSelect.addEventListener("change", async () => {
      try {
        await updateDoc(doc(db, "tasks", task.id), {
          status: statusSelect.value
        });
        await loadTasks(currentUser.uid);
      } catch (error) {
        alert("Status update failed: " + error.message);
      }
    });

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editTask(task));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(statusSelect, editBtn, deleteBtn);
    item.append(title, description, deadline, status, actions);
    taskContainer.appendChild(item);
  });

  updateDashboard();
}

// Add task to Firestore
taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    alert("Please sign in first.");
    return;
  }

  const title = document.getElementById("taskTitle").value.trim();
  const description =
    document.getElementById("taskDescription").value.trim();
  const deadline = document.getElementById("taskDeadline").value;

  if (!title || !deadline) {
    alert("Please enter a title and deadline.");
    return;
  }

  const uid = currentUser.uid;

  try {
    await addDoc(collection(db, "tasks"), {
      title,
      description,
      deadline,
      status: "pending",
      userId: uid
    });

    taskForm.reset();
    await loadTasks(uid);
  } catch (error) {
    console.error("Add task error:", error);
    alert("Unable to add task: " + error.message);
  }
});

// Edit task
async function editTask(task) {
  if (!currentUser) return;

  const title = prompt("Edit task title:", task.title);
  if (title === null) return;

  if (!title.trim()) {
    alert("Task title cannot be empty.");
    return;
  }

  const description = prompt(
    "Edit task description:", task.description || ""
  );
  if (description === null) return;

  const deadline = prompt("Edit deadline (YYYY-MM-DD):", task.deadline);
  if (deadline === null) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(Date.parse(deadline))) {
    alert("Please enter a valid date.");
    return;
  }

  const uid = currentUser.uid;

  try {
    await updateDoc(doc(db, "tasks", task.id), {
      title: title.trim(),
      description: description.trim(),
      deadline
    });

    await loadTasks(uid);
  } catch (error) {
    alert("Unable to edit task: " + error.message);
  }
}

// Delete task
async function deleteTask(id) {
  if (!currentUser) return;
  if (!confirm("Delete this task?")) return;

  const uid = currentUser.uid;

  try {
    await deleteDoc(doc(db, "tasks", id));
    await loadTasks(uid);
  } catch (error) {
    alert("Unable to delete task: " + error.message);
  }
}

// Filter tasks
taskFilter.addEventListener("change", displayTasks);

// Hide task form until authentication is confirmed
taskForm.hidden = true;
taskFilter.disabled = true;

displayTasks();
