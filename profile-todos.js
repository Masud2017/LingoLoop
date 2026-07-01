const TODO_REMINDER_WINDOW = 15 * 60 * 1000;
let todoReminderShownFor = new Set();

function todoUserId() {
  return window.lingoUser?.id || '';
}

function todoKey(uid = todoUserId()) {
  return `lingoloop-profile-todos-${uid}`;
}

function todoToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(todoToast.timer);
  todoToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function loadTodos(uid = todoUserId()) {
  if (!uid) return [];
  try {
    return JSON.parse(localStorage.getItem(todoKey(uid)) || '[]');
  } catch (_) {
    return [];
  }
}

function saveTodos(todos, uid = todoUserId()) {
  if (!uid) return;
  localStorage.setItem(todoKey(uid), JSON.stringify(todos.slice(0, 80)));
}

function formatDue(value) {
  if (!value) return 'No reminder';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'No reminder';
  const diff = time - Date.now();
  if (diff < 0) return 'Due now';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `Due in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Due in ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `Due in ${days} day${days === 1 ? '' : 's'}`;
}

function todoNeedsAttention(todo) {
  if (todo.done) return false;
  if (todo.priority === 'urgent') return true;
  const due = todo.dueAt ? new Date(todo.dueAt).getTime() : 0;
  return Number.isFinite(due) && due > 0 && due <= Date.now() + TODO_REMINDER_WINDOW;
}

function renderTodoList(target, todos, options = {}) {
  if (!target) return;
  target.innerHTML = '';
  const activeTodos = todos.filter(todo => !todo.done);
  const visible = options.compact ? todos.slice(0, 5) : todos;
  if (!visible.length) {
    target.innerHTML = '<p>No tasks yet. Add one tiny mission.</p>';
    return;
  }
  visible.forEach(todo => {
    const item = document.createElement('article');
    item.className = `todo-item ${todo.priority || 'normal'} ${todo.done ? 'done' : ''} ${todoNeedsAttention(todo) ? 'due' : ''}`;
    item.dataset.todoId = todo.id;
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-check';
    check.title = todo.done ? 'Mark active' : 'Mark done';
    check.innerHTML = `<span class="material-symbols-rounded">${todo.done ? 'undo' : 'check'}</span>`;
    const copy = document.createElement('div');
    copy.className = 'todo-copy';
    const title = document.createElement('b');
    title.textContent = todo.text;
    if (todo.done) title.className = 'todo-done-text';
    const meta = document.createElement('small');
    meta.innerHTML = `<span class="todo-priority">${todo.priority || 'normal'}</span><span>${formatDue(todo.dueAt)}</span>`;
    copy.append(title, meta);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'todo-delete';
    remove.title = 'Delete task';
    remove.innerHTML = '<span class="material-symbols-rounded">delete</span>';
    item.append(check, copy, remove);
    target.appendChild(item);
  });
  if (options.compact && todos.length > visible.length) {
    const more = document.createElement('p');
    more.textContent = `${todos.length - visible.length} more task${todos.length - visible.length === 1 ? '' : 's'} on your profile page.`;
    target.appendChild(more);
  }
  if (!activeTodos.length && todos.length) {
    const done = document.createElement('p');
    done.textContent = 'All caught up. Beautiful.';
    target.appendChild(done);
  }
}

function updateTodoBadges(todos = loadTodos()) {
  const dueCount = todos.filter(todoNeedsAttention).length;
  ['todoAlertBadge','memberTodoAlert'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    badge.hidden = dueCount === 0;
    badge.textContent = `${dueCount} due`;
  });
}

function renderTodos() {
  const uid = todoUserId();
  const todos = loadTodos(uid).sort((a, b) => {
    const priorityRank = { urgent: 0, high: 1, normal: 2 };
    return Number(a.done) - Number(b.done)
      || (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
      || (new Date(a.dueAt || 8640000000000000) - new Date(b.dueAt || 8640000000000000));
  });
  renderTodoList(document.getElementById('todoList'), todos, { compact: true });
  renderTodoList(document.getElementById('memberTodoList'), todos);
  updateTodoBadges(todos);
  remindPriorityTodos(todos);
}

function remindPriorityTodos(todos = loadTodos()) {
  const attention = todos.filter(todoNeedsAttention);
  if (!attention.length) return;
  const first = attention[0];
  if (todoReminderShownFor.has(first.id)) return;
  todoReminderShownFor.add(first.id);
  todoToast(`Reminder: ${first.text}`);
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    new Notification('LingoLoop priority reminder', { body: first.text, tag: `todo-${first.id}` });
  }
}

function mutateTodo(id, updater) {
  const todos = loadTodos();
  const next = todos.map(todo => todo.id === id ? updater(todo) : todo).filter(Boolean);
  saveTodos(next);
  renderTodos();
}

document.getElementById('todoForm')?.addEventListener('submit', event => {
  event.preventDefault();
  if (!todoUserId()) return todoToast('Sign in to save your todo list');
  const textInput = document.getElementById('todoText');
  const priority = document.getElementById('todoPriority').value;
  const dueAt = document.getElementById('todoDue').value;
  const text = textInput.value.trim();
  if (!text) return;
  const todos = loadTodos();
  todos.push({ id: crypto.randomUUID?.() || String(Date.now()), text, priority, dueAt, done: false, createdAt: Date.now() });
  saveTodos(todos);
  event.currentTarget.reset();
  renderTodos();
  todoToast(priority === 'urgent' ? "Urgent task added - I'll keep it visible." : 'Task added to your profile');
});

document.addEventListener('click', event => {
  const item = event.target.closest('.todo-item');
  if (!item) return;
  if (event.target.closest('.todo-check')) mutateTodo(item.dataset.todoId, todo => ({ ...todo, done: !todo.done }));
  if (event.target.closest('.todo-delete')) mutateTodo(item.dataset.todoId, () => null);
});

window.addEventListener('lingo-auth-changed', () => {
  todoReminderShownFor = new Set();
  renderTodos();
});
setInterval(renderTodos, 60000);
window.renderTodos = renderTodos;
document.documentElement.dataset.todosReady = 'true';
renderTodos();
