const memberProfilePage = document.getElementById('memberProfilePage');
const profileChannelGrid = document.getElementById('profileChannelGrid');

function closeMemberProfile() {
  memberProfilePage.classList.remove('open');
  memberProfilePage.setAttribute('aria-hidden', 'true');
  if (location.hash.startsWith('#profile/')) history.replaceState(null, '', '#rooms');
}

async function ensureOwnProfileRegistered(uid) {
  const user = window.lingoUser;
  if (!user || user.id !== uid) return false;
  const response = await fetch('/api/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: user.id,
      name: user.name || 'Learner',
      firstName: (user.name || 'Learner').split(/\s+/)[0],
      avatar: user.avatar || ''
    })
  });
  return response.ok;
}

async function fetchProfile(uid) {
  let response = await fetch(`/api/profiles/${encodeURIComponent(uid)}`);
  if (response.status === 404 && await ensureOwnProfileRegistered(uid)) {
    response = await fetch(`/api/profiles/${encodeURIComponent(uid)}`);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Profile unavailable');
  return data;
}

window.openMemberProfile = async uid => {
  if (!uid) return;
  memberProfilePage.classList.add('open');
  memberProfilePage.setAttribute('aria-hidden', 'false');
  document.getElementById('profileLoading').hidden = false;
  document.getElementById('profileLoading').textContent = 'Loading profile...';
  document.getElementById('memberProfileContent').hidden = true;
  history.replaceState(null, '', `#profile/${encodeURIComponent(uid)}`);

  try {
    const data = await fetchProfile(uid);
    document.getElementById('memberPageAvatar').src = data.user.avatar;
    document.getElementById('memberPageName').textContent = data.user.name;
    document.getElementById('memberPageHandle').textContent = data.user.handle;
    document.getElementById('memberChannelCount').textContent = data.channelCount;
    document.getElementById('memberBehaviorPoints').textContent = data.behaviorPoints;

    const isOwnProfile = data.user.uid === window.lingoUser?.id;
    const todoSection = document.getElementById('memberTodoSection');
    const shoutSection = document.getElementById('memberLingoShoutSection');
    if (todoSection) todoSection.hidden = !isOwnProfile;
    if (shoutSection) shoutSection.hidden = !isOwnProfile;
    window.renderTodos?.();

    profileChannelGrid.innerHTML = '';
    if (!data.channels.length) {
      profileChannelGrid.innerHTML = '<p class="profile-empty">No active channels. Unused channels expire after three days.</p>';
    }
    data.channels.forEach(channel => {
      const card = document.createElement('article');
      card.className = 'profile-channel';
      const language = document.createElement('span');
      const title = document.createElement('h3');
      const meta = document.createElement('p');
      language.textContent = channel.language;
      title.textContent = channel.name;
      const days = Math.max(1, Math.ceil((channel.expiresAt - Date.now()) / 86400000));
      meta.textContent = `Up to ${channel.memberLimit} members - expires in ${days} day${days === 1 ? '' : 's'} if unused`;
      card.append(language, title, meta);
      profileChannelGrid.appendChild(card);
    });

    document.getElementById('profileLoading').hidden = true;
    document.getElementById('memberProfileContent').hidden = false;
  } catch (error) {
    document.getElementById('profileLoading').textContent = error.message;
  }
};

document.getElementById('closeMemberProfile')?.addEventListener('click', closeMemberProfile);
document.getElementById('viewMyPublicProfile')?.addEventListener('click', () => {
  if (!window.lingoUser) return;
  document.getElementById('profileBackdrop')?.classList.remove('open');
  window.openMemberProfile(window.lingoUser.id);
});
document.getElementById('openMyProfileShortcut')?.addEventListener('click', () => {
  if (window.lingoUser) window.openMemberProfile(window.lingoUser.id);
});

window.addEventListener('DOMContentLoaded', () => {
  if (location.hash.startsWith('#profile/')) window.openMemberProfile(decodeURIComponent(location.hash.slice(9)));
});

