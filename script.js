const DB_KEYS = {
  users: "users_v1",
  laws: "laws_v1",
  logs: "auditLogs_v1",
  session: "session_v1"
};

const ROLES = {
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  CITIZEN: "CITIZEN"
};

const DEFAULT_LAWS = [
  { id: "000", title: "Ústava", content: "Ústava + dodatky" },
  { id: "100", title: "Penal Code", content: "Trestní zákoník" },
  { id: "200", title: "Traffic Code", content: "Dopravní předpisy" },
  { id: "500", title: "Police Procedures", content: "Policejní postupy" },
  { id: "701", title: "Procesní pravidla", content: "Soudní pravidla" }
];

const state = {
  users: getDB(DB_KEYS.users, []),
  laws: getDB(DB_KEYS.laws, DEFAULT_LAWS),
  logs: getDB(DB_KEYS.logs, []),
  currentUser: getDB(DB_KEYS.session, null),
  selectedLawId: null,
  search: ""
};

const el = {
  authSection: document.getElementById("auth-section"),
  appSection: document.getElementById("app-section"),
  bootstrapSection: document.getElementById("bootstrap-section"),
  bootstrapUsername: document.getElementById("bootstrap-username"),
  bootstrapPassword: document.getElementById("bootstrap-password"),
  bootstrapBtn: document.getElementById("bootstrap-btn"),
  registerUsername: document.getElementById("register-username"),
  registerPassword: document.getElementById("register-password"),
  registerBtn: document.getElementById("register-btn"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginBtn: document.getElementById("login-btn"),
  authMessage: document.getElementById("auth-message"),
  currentUser: document.getElementById("current-user"),
  logoutBtn: document.getElementById("logout-btn"),
  search: document.getElementById("search"),
  lawsList: document.getElementById("laws-list"),
  lawDetail: document.getElementById("law-detail"),
  roleManagementCard: document.getElementById("role-management-card"),
  userRoleList: document.getElementById("user-role-list"),
  addLawCard: document.getElementById("add-law-card"),
  newLawTitle: document.getElementById("new-law-title"),
  newLawContent: document.getElementById("new-law-content"),
  addLawBtn: document.getElementById("add-law-btn"),
  auditCard: document.getElementById("audit-card"),
  auditList: document.getElementById("audit-list")
};

bindEvents();
render();

function getDB(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setDB(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bindEvents() {
  el.bootstrapBtn.addEventListener("click", onBootstrapSuperAdmin);
  el.registerBtn.addEventListener("click", onRegister);
  el.loginBtn.addEventListener("click", onLogin);
  el.logoutBtn.addEventListener("click", onLogout);
  el.search.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderLaws();
  });
  el.addLawBtn.addEventListener("click", onAddLaw);
}

function hasSuperAdmin() {
  return state.users.some((u) => u.role === ROLES.SUPERADMIN);
}

async function onBootstrapSuperAdmin() {
  if (hasSuperAdmin()) {
    return setAuthMessage("SUPERADMIN už existuje.");
  }

  const username = el.bootstrapUsername.value.trim();
  const password = el.bootstrapPassword.value;

  if (!username || !password) {
    return setAuthMessage("Vyplň jméno i heslo pro SUPERADMIN.");
  }

  if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return setAuthMessage("Toto jméno už existuje.");
  }

  const passwordHash = await sha256(password);
  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role: ROLES.SUPERADMIN
  };

  state.users.push(user);
  persistUsers();
  addLog("SYSTEM", "BOOTSTRAP_SUPERADMIN", `Vytvořen SUPERADMIN ${username}`);

  el.bootstrapUsername.value = "";
  el.bootstrapPassword.value = "";
  setAuthMessage("SUPERADMIN účet vytvořen. Teď se přihlas.", true);
  renderAuthVisibility();
}

async function onRegister() {
  if (!hasSuperAdmin()) {
    return setAuthMessage("Nejdřív vytvoř SUPERADMIN účet v horní sekci.");
  }

  const username = el.registerUsername.value.trim();
  const password = el.registerPassword.value;

  if (!username || !password) {
    return setAuthMessage("Vyplň jméno i heslo.");
  }

  if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return setAuthMessage("Uživatel už existuje.");
  }

  const passwordHash = await sha256(password);
  const user = {
    id: crypto.randomUUID(),
    username,
    passwordHash,
    role: ROLES.CITIZEN
  };

  state.users.push(user);
  persistUsers();
  addLog("SYSTEM", "REGISTER", `Registrován uživatel ${username} (CITIZEN)`);

  el.registerUsername.value = "";
  el.registerPassword.value = "";
  setAuthMessage("Registrace proběhla. Nyní se přihlas.", true);
}

async function onLogin() {
  const username = el.loginUsername.value.trim();
  const password = el.loginPassword.value;

  const user = state.users.find((u) => u.username === username);
  if (!user) return setAuthMessage("Neplatné přihlašovací údaje.");

  const passwordHash = await sha256(password);
  if (user.passwordHash !== passwordHash) {
    return setAuthMessage("Neplatné přihlašovací údaje.");
  }

  state.currentUser = { id: user.id, username: user.username, role: user.role };
  setDB(DB_KEYS.session, state.currentUser);
  addLog(user.username, "LOGIN", `${user.username} se přihlásil`);

  el.loginUsername.value = "";
  el.loginPassword.value = "";
  setAuthMessage("");
  render();
}

function onLogout() {
  if (!state.currentUser) return;
  addLog(state.currentUser.username, "LOGOUT", `${state.currentUser.username} se odhlásil`);
  state.currentUser = null;
  setDB(DB_KEYS.session, null);
  state.selectedLawId = null;
  render();
}

function onAddLaw() {
  if (!isSuperAdmin()) return;

  const title = el.newLawTitle.value.trim();
  const content = el.newLawContent.value.trim();

  if (!title || !content) return;

  const law = {
    id: Date.now().toString(),
    title,
    content
  };

  state.laws.push(law);
  persistLaws();
  addLog(state.currentUser.username, "ADD_LAW", `Přidán zákon ${title}`);

  el.newLawTitle.value = "";
  el.newLawContent.value = "";
  renderLaws();
}

function deleteLaw(lawId) {
  if (!isSuperAdmin()) return;
  const law = state.laws.find((l) => l.id === lawId);
  if (!law) return;

  state.laws = state.laws.filter((l) => l.id !== lawId);
  persistLaws();
  addLog(state.currentUser.username, "DELETE_LAW", `Smazán zákon ${law.title}`);

  if (state.selectedLawId === lawId) state.selectedLawId = null;
  renderLaws();
}

function render() {
  const loggedIn = !!state.currentUser;
  el.authSection.classList.toggle("hidden", loggedIn);
  el.appSection.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) {
    renderAuthVisibility();
    return;
  }

  el.currentUser.textContent = `${state.currentUser.username} (${state.currentUser.role})`;

  const superAdmin = isSuperAdmin();
  el.roleManagementCard.classList.toggle("hidden", !superAdmin);
  el.addLawCard.classList.toggle("hidden", !superAdmin);
  el.auditCard.classList.toggle("hidden", !superAdmin);

  renderUserRoles();
  renderLaws();
  renderAudit();
}

function renderAuthVisibility() {
  el.bootstrapSection.classList.toggle("hidden", hasSuperAdmin());
}

function renderUserRoles() {
  if (!isSuperAdmin()) return;

  const otherUsers = state.users.filter((u) => u.role !== ROLES.SUPERADMIN);
  if (!otherUsers.length) {
    el.userRoleList.innerHTML = "<li>Zatím žádní uživatelé.</li>";
    return;
  }

  el.userRoleList.innerHTML = "";

  otherUsers.forEach((user) => {
    const li = document.createElement("li");
    li.className = "list-item";

    const info = document.createElement("span");
    info.textContent = `${user.username} (${user.role})`;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn";

    const promotingToAdmin = user.role !== ROLES.ADMIN;
    toggleBtn.textContent = promotingToAdmin ? "Nastavit ADMIN" : "Nastavit OBČAN";

    toggleBtn.addEventListener("click", () => {
      user.role = promotingToAdmin ? ROLES.ADMIN : ROLES.CITIZEN;
      persistUsers();
      addLog(state.currentUser.username, "ROLE_CHANGE", `${user.username} -> ${user.role}`);

      if (state.currentUser.id === user.id) {
        state.currentUser.role = user.role;
        setDB(DB_KEYS.session, state.currentUser);
      }

      render();
    });

    li.append(info, toggleBtn);
    el.userRoleList.appendChild(li);
  });
}

function renderLaws() {
  if (!state.currentUser) return;

  const filtered = state.laws.filter((law) => {
    if (!state.search) return true;
    return (
      law.title.toLowerCase().includes(state.search) ||
      law.content.toLowerCase().includes(state.search)
    );
  });

  el.lawsList.innerHTML = "";

  filtered.forEach((law) => {
    const li = document.createElement("li");
    li.className = "list-item";

    const title = document.createElement("strong");
    title.textContent = `${law.id} - ${law.title}`;

    const openBtn = document.createElement("button");
    openBtn.className = "btn";
    openBtn.textContent = "Otevřít";
    openBtn.addEventListener("click", () => {
      state.selectedLawId = law.id;
      renderLawDetail();
    });

    li.append(title, openBtn);
    el.lawsList.appendChild(li);
  });

  renderLawDetail();
}

function renderLawDetail() {
  if (!state.selectedLawId) {
    el.lawDetail.innerHTML = "<p>Vyber zákon ze seznamu.</p>";
    return;
  }

  const law = state.laws.find((l) => l.id === state.selectedLawId);
  if (!law) {
    el.lawDetail.innerHTML = "<p>Zákon nenalezen.</p>";
    return;
  }

  const canEdit = isAdminOrSuperAdmin();
  const canDelete = isSuperAdmin();

  const wrapper = document.createElement("div");
  const h3 = document.createElement("h3");
  h3.textContent = `${law.id} - ${law.title}`;

  const content = document.createElement("textarea");
  content.value = law.content;
  content.rows = 8;
  content.disabled = !canEdit;

  wrapper.append(h3, content);

  if (canEdit) {
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn";
    saveBtn.textContent = "Uložit změny";
    saveBtn.addEventListener("click", () => {
      law.content = content.value.trim();
      persistLaws();
      addLog(state.currentUser.username, "EDIT_LAW", `Upraven zákon ${law.title}`);
      renderLaws();
    });
    wrapper.appendChild(saveBtn);
  }

  if (canDelete) {
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn danger";
    deleteBtn.textContent = "Smazat zákon";
    deleteBtn.addEventListener("click", () => deleteLaw(law.id));
    wrapper.appendChild(deleteBtn);
  }

  el.lawDetail.innerHTML = "";
  el.lawDetail.appendChild(wrapper);
}

function renderAudit() {
  if (!isSuperAdmin()) return;

  el.auditList.innerHTML = "";
  state.logs.forEach((log) => {
    const li = document.createElement("li");
    li.textContent = `[${log.time}] (${log.user}) ${log.action} - ${log.message}`;
    el.auditList.appendChild(li);
  });
}

function addLog(user, action, message) {
  state.logs.unshift({
    time: new Date().toLocaleString(),
    user,
    action,
    message
  });
  setDB(DB_KEYS.logs, state.logs);
}

function persistUsers() {
  setDB(DB_KEYS.users, state.users);
}

function persistLaws() {
  setDB(DB_KEYS.laws, state.laws);
}

function isSuperAdmin() {
  return state.currentUser?.role === ROLES.SUPERADMIN;
}

function isAdminOrSuperAdmin() {
  return [ROLES.ADMIN, ROLES.SUPERADMIN].includes(state.currentUser?.role);
}

function setAuthMessage(text, success = false) {
  el.authMessage.textContent = text;
  el.authMessage.style.color = success ? "#065f46" : "#991b1b";
}
