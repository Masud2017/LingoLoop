if (location.protocol === 'file:') location.replace(`http://localhost:4173/${location.hash}`);

let filters = [...document.querySelectorAll('.filter')];
let cards = [...document.querySelectorAll('.room-card')];
const search = document.getElementById('roomSearch');
const empty = document.getElementById('emptyState');
const modal = document.getElementById('modalBackdrop');
const toast = document.getElementById('toast');
const levelFilter = document.getElementById('levelFilter');
const availabilityFilter = document.getElementById('availabilityFilter');
const sortFilter = document.getElementById('sortFilter');
const roomResults = document.getElementById('roomResults');
let currentLanguage = 'All';
let editingRoomId = null;
const CHANNEL_PAGE_SIZE = 15;
let visibleRoomLimit = CHANNEL_PAGE_SIZE;
const supportedLanguages = [
  ['English','EN'],['Spanish','ES'],['French','FR'],['Arabic','AR'],['Bengali','BN'],['Hindi','HI'],['Portuguese','PT'],['Russian','RU'],['Japanese','JA'],['German','DE'],
  ['Korean','KO'],['Italian','IT'],['Turkish','TR'],['Vietnamese','VI'],['Polish','PL'],['Dutch','NL'],['Greek','EL'],['Hebrew','HE'],['Thai','TH'],['Indonesian','ID'],
  ['Urdu','UR'],['Persian','FA'],['Swahili','SW'],['Malay','MS'],['Filipino','TL'],['Ukrainian','UK'],['Romanian','RO'],['Czech','CS'],['Hungarian','HU'],['Swedish','SV'],
  ['Norwegian','NO'],['Danish','DA'],['Finnish','FI'],['Tamil','TA'],['Telugu','TE'],['Marathi','MR'],['Gujarati','GU'],['Punjabi','PA'],['Kannada','KN'],['Malayalam','ML'],
  ['Chinese','ZH'],['Cantonese','YUE'],['Amharic','AM'],['Yoruba','YO'],['Igbo','IG'],['Zulu','ZU'],['Afrikaans','AF'],['Serbian','SR'],['Croatian','HR'],['Bulgarian','BG']
];
const languageFlags = Object.fromEntries(supportedLanguages);
const roomLevels = ['Beginner','Elementary','Intermediate','Upper intermediate','Advanced','Fluent','Native practice','All levels'];

function populateLanguageUI() {
  const filtersWrap = document.querySelector('.filters');
  const languageSelect = document.querySelector('#roomForm select[name="language"]');
  const levelSelect = document.querySelector('#roomForm select[name="level"]');
  const discoveryLevelSelect = document.getElementById('levelFilter');
  if (filtersWrap) {
    filtersWrap.innerHTML = '<button class="filter active" data-language="All">All rooms <span>All</span></button>' + supportedLanguages.map(([language,flag]) => `<button class="filter" data-language="${language}">${flag} ${language}</button>`).join('');
  }
  if (languageSelect) languageSelect.innerHTML = supportedLanguages.map(([language,flag]) => `<option value="${language}">${flag} ${language}</option>`).join('');
  if (levelSelect) levelSelect.innerHTML = roomLevels.map(level => `<option value="${level}">${level}</option>`).join('');
  if (discoveryLevelSelect) discoveryLevelSelect.innerHTML = '<option value="All">All levels</option>' + roomLevels.map(level => `<option value="${level}">${level}</option>`).join('');
}
populateLanguageUI();
filters = [...document.querySelectorAll('.filter')];

function createGroupAvatar(title, index) {
  const palettes = [['#d4ecda','#4f8060','#ffb59e'],['#dbe9fa','#54779e','#ffd277'],['#eee0fa','#735f91','#9edbc0'],['#ffe4dc','#9c5c51','#b8d7f0']];
  const [bg, dark, accent] = palettes[index % palettes.length];
  const initials = title.split(/\s+/).filter(word => /[a-z]/i.test(word)).slice(0,2).map(word => word[0].toUpperCase()).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${bg}"/><circle cx="31" cy="43" r="18" fill="${accent}"/><circle cx="69" cy="43" r="18" fill="${dark}" opacity=".78"/><path d="M13 88c2-23 16-34 37-34s35 11 37 34" fill="${dark}"/><circle cx="50" cy="38" r="21" fill="${accent}"/><circle cx="43" cy="36" r="2" fill="#26352d"/><circle cx="57" cy="36" r="2" fill="#26352d"/><path d="M44 46c4 4 8 4 12 0" fill="none" stroke="#26352d" stroke-width="2" stroke-linecap="round"/><text x="50" y="79" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="white">${initials}</text></svg>`;
  return { src:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, background:bg };
}

function decorateRoomCard(card,index) {
  if (card.querySelector('.group-visual')) return;
  const title = card.querySelector('h3').textContent;
  const avatar = createGroupAvatar(title,index);
  const visual = document.createElement('div'); visual.className='group-visual'; visual.style.setProperty('--group-bg',avatar.background);
  const image = document.createElement('img'); image.className='group-avatar'; image.src=avatar.src; image.alt=`Generated avatar for ${title}`;
  const activity = document.createElement('span'); activity.className='group-visual-copy'; activity.innerHTML='<i></i> ACTIVE NOW';
  visual.append(image,activity); card.prepend(visual);
}

function buildRoomCard(room) {
  const flags = { English:'EN', Spanish:'ES', French:'FR', Japanese:'JA', German:'DE', Portuguese:'PT' };
  const level = room.level || 'All levels';
  const card = document.createElement('article');
  card.className = 'room-card featured';
  card.dataset.language = room.language;
  card.dataset.search = `${room.name} ${room.language} ${level} community new`.toLowerCase();
  card.dataset.roomId = room.id;
  card.dataset.memberLimit = String(room.memberLimit || 12);
  card.dataset.level = level;
  card.dataset.seats = String((room.memberLimit || 12)-1);
  card.dataset.participants = '1';
  card.dataset.createdAt = String(room.createdAt || Date.now());
  card.dataset.creatorId=room.creatorId||'';
  card.dataset.expiresAt=String(room.expiresAt||'');
  card.innerHTML = `<div class="room-top"><div class="room-language"><span>${flags[room.language] || 'WW'}</span><div><small>${room.language.toUpperCase()} - COMMUNITY</small><h3></h3></div></div><div class="owner-actions" hidden><button class="edit-room" aria-label="Edit channel" title="Edit channel"><span class="material-symbols-rounded">edit</span></button><button class="delete-room" aria-label="Delete channel" title="Delete channel"><span class="material-symbols-rounded">delete</span></button></div></div><p>A fresh community room for up to ${room.memberLimit || 12} members.</p><div class="room-bottom"><button class="people creator-profile" type="button"><div class="avatar-stack"><span class="avatar lavender">HOST</span></div><span><b></b><small>1 speaking - ${(room.memberLimit || 12)-1} seats left</small></span></button><button class="join-button">Join room <span class="material-symbols-rounded">arrow_forward</span></button></div>`;
  const languageBadge = card.querySelector('.room-language span');
  const languageMeta = card.querySelector('.room-language small');
  const cardCopy = card.querySelector('.room-top + p');
  if (languageBadge) languageBadge.textContent = languageFlags[room.language] || 'WW';
  if (languageMeta) languageMeta.textContent = `${room.language.toUpperCase()} - ${level.toUpperCase()}`;
  if (cardCopy) cardCopy.textContent = `A fresh ${level.toLowerCase()} room for up to ${room.memberLimit || 12} members.`;
  card.querySelector('h3').textContent = room.name;
  card.querySelector('.people b').textContent=room.creatorName?`Hosted by ${room.creatorName}`:'Community host';
  return card;
}

let savedRooms = [];
try { savedRooms = JSON.parse(localStorage.getItem('lingoloop-rooms') || '[]').filter(room=>!room.expiresAt||room.expiresAt>Date.now()); } catch (_) {}
savedRooms.forEach(room => {
  const card = buildRoomCard(room);
  document.getElementById('roomsGrid').prepend(card);
  cards.unshift(card);
});
cards.forEach(decorateRoomCard);
function syncOwnerControls(){cards.forEach(card=>{const actions=card.querySelector('.owner-actions');if(actions)actions.hidden=!window.lingoUser||card.dataset.creatorId!==window.lingoUser.id})}
async function loadPersistentChannels(){try{const response=await fetch('/api/channels'),data=await response.json();(data.channels||[]).forEach(room=>{if(cards.some(card=>card.dataset.roomId===room.id))return;savedRooms.push(room);const card=buildRoomCard(room);document.getElementById('roomsGrid').prepend(card);cards.unshift(card);decorateRoomCard(card,cards.length)});syncOwnerControls();filterRooms()}catch(_){}}
loadPersistentChannels();
window.addEventListener('lingo-auth-changed',async event=>{syncOwnerControls();const user=event.detail;if(!user)return;for(const room of savedRooms.filter(item=>!item.creatorId)){Object.assign(room,{creatorId:user.id,creatorName:user.name,creatorHandle:user.handle,creatorAvatar:user.avatar,expiresAt:Date.now()+3*24*60*60*1000});const card=cards.find(item=>item.dataset.roomId===room.id);if(card){card.dataset.creatorId=user.id;card.dataset.expiresAt=room.expiresAt;card.querySelector('.people b').textContent=`Hosted by ${user.name}`}await fetch('/api/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(room)})}localStorage.setItem('lingoloop-rooms',JSON.stringify(savedRooms));syncOwnerControls()});

const loadMoreRooms = document.createElement('button');
loadMoreRooms.type = 'button';
loadMoreRooms.className = 'load-more-rooms';
loadMoreRooms.textContent = 'Load 15 more rooms';
document.getElementById('roomsGrid').after(loadMoreRooms);
loadMoreRooms.addEventListener('click', () => {
  visibleRoomLimit += CHANNEL_PAGE_SIZE;
  filterRooms();
});
function resetRoomPaging() {
  visibleRoomLimit = CHANNEL_PAGE_SIZE;
}

function filterRooms() {
  const query = search.value.trim().toLowerCase();
  let totalMatches = 0;
  let shown = 0;
  cards.forEach(card => {
    const languageMatch = currentLanguage === 'All' || card.dataset.language === currentLanguage;
    const levelMatch = levelFilter.value === 'All' || card.dataset.level === levelFilter.value;
    const seats = Number(card.dataset.seats || 0);
    const availabilityMatch = availabilityFilter.value === 'All' || (availabilityFilter.value === 'Open' && seats > 0) || (availabilityFilter.value === 'Small' && Number(card.dataset.participants || 0) <= 8);
    const searchMatch = !query || card.dataset.search.includes(query) || card.textContent.toLowerCase().includes(query);
    const matches = languageMatch && levelMatch && availabilityMatch && searchMatch;
    if (matches) totalMatches++;
    const show = matches && shown < visibleRoomLimit;
    if (show) shown++;
    card.hidden = !show;
  });
  const sorted = [...cards].sort((a,b) => {
    if (sortFilter.value === 'newest') return Number(b.dataset.createdAt)-Number(a.dataset.createdAt);
    if (sortFilter.value === 'az') return a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent);
    return Number(b.dataset.participants)-Number(a.dataset.participants);
  });
  sorted.forEach(card => document.getElementById('roomsGrid').appendChild(card));
  roomResults.textContent = `${shown} of ${totalMatches} ${totalMatches === 1 ? 'group' : 'groups'} shown`;
  empty.style.display = totalMatches ? 'none' : 'block';
  loadMoreRooms.hidden = shown >= totalMatches;
}

filters.forEach(filter => filter.addEventListener('click', () => {
  filters.forEach(item => item.classList.remove('active'));
  filter.classList.add('active');
  currentLanguage = filter.dataset.language;
  resetRoomPaging();
  filterRooms();
}));
search.addEventListener('input', () => { resetRoomPaging(); filterRooms(); });
[levelFilter,availabilityFilter,sortFilter].forEach(control => control.addEventListener('change',()=>{resetRoomPaging();filterRooms()}));
document.getElementById('clearFilters').addEventListener('click',() => {
  currentLanguage='All'; search.value=''; levelFilter.value='All'; availabilityFilter.value='All'; sortFilter.value='popular';
  filters.forEach(item => item.classList.toggle('active',item.dataset.language==='All'));
  resetRoomPaging();
  filterRooms();
});
filterRooms();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function openModal() {
  editingRoomId = null;
  document.getElementById('modalTitle').textContent = 'Create a conversation';
  document.querySelector('#roomForm button[type="submit"]').textContent = 'Create room ->';
  document.getElementById('roomForm').reset();
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => modal.querySelector('input').focus(), 100);
}
function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openRoom').addEventListener('click', openModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
document.getElementById('playStory').addEventListener('click', () => document.getElementById('how').scrollIntoView({behavior:'smooth'}));
const callScreen = document.getElementById('callScreen');
const muteButton = document.getElementById('muteButton');
const handButton = document.getElementById('handButton');
const ircForm = document.getElementById('ircForm');
const ircInput = document.getElementById('ircInput');
const ircMessages = document.getElementById('ircMessages');
let microphoneStream = null;
let screenStream = null;
let roomChannel = null;
let voiceAudioContext = null;
let voiceFrame = null;
const rtcPeers = new Map();
const storedClientId=sessionStorage.getItem('lingoloop-voice-client-id');
const clientId = storedClientId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
sessionStorage.setItem('lingoloop-voice-client-id',clientId);
let rtcRoom = null;
let signalPoll = null;
let activeRoomLimit = 12;
let isRoomHost = false;
let activeVoiceRoomKey = null;
const channelProfiles = new Map();
let lastLocalSpeaking = false;
let localSpeakingTimer = null;

function initialsFromName(name='Member') {
  return String(name || 'Member').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase() || 'M';
}
function profileAvatarMarkup(profile, fallback='M') {
  if (profile?.avatar) return `<img src="${profile.avatar}" alt="">`;
  return initialsFromName(profile?.name || fallback);
}
function currentProfile() {
  return window.lingoUser ? {uid:window.lingoUser.id,name:window.lingoUser.name,handle:window.lingoUser.handle,avatar:window.lingoUser.avatar} : null;
}
function updateSelfSpeakerProfile() {
  const profile=currentProfile(), self=document.getElementById('selfSpeaker');
  if(!self||!profile)return;
  self.dataset.userId=profile.uid;
  self.dataset.friendId=profile.uid;
  self.dataset.friendName=profile.name;
  self.dataset.friendHandle=profile.handle||'';
  self.querySelector('.speaker-avatar').innerHTML=`${profileAvatarMarkup(profile,'YOU')}<span class="mic-chip muted" id="selfMicChip">x</span>`;
  self.querySelector('h3').innerHTML=`${profile.name} <span>(you)</span>`;
}

async function sendSignal(to, type, payload) {
  await fetch('/api/signal', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ from:clientId, fromProfile:currentProfile(), to, type, payload }) });
}

function createPeer(remoteId) {
  if (rtcPeers.has(remoteId)) return rtcPeers.get(remoteId);
  const pc = new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] });
  if (microphoneStream) microphoneStream.getTracks().forEach(track => pc.addTrack(track, microphoneStream));
  else pc.addTransceiver('audio', { direction:'recvonly' });
  screenStream?.getVideoTracks().forEach(track => pc.addTrack(track, screenStream));
  pc.onicecandidate = event => { if (event.candidate) sendSignal(remoteId, 'ice', event.candidate); };
  pc.ontrack = event => {
    if(event.track.kind === 'video') {
      attachScreenShare(event.streams[0], channelProfiles.get(remoteId)?.name || 'A member');
      return;
    }
    let audio = document.getElementById(`remote-${remoteId}`);
    if (!audio) { audio = document.createElement('audio'); audio.id = `remote-${remoteId}`; audio.autoplay = true; audio.playsInline = true; document.body.appendChild(audio); }
    audio.srcObject = event.streams[0];
    audio.play().catch(() => showToast('Tap the page once to enable incoming audio'));
    watchRemoteVoiceActivity(remoteId, event.streams[0]);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') document.querySelector('.call-status span').textContent = 'Voice connected';
    if (['failed','closed'].includes(pc.connectionState)) rtcPeers.delete(remoteId);
  };
  rtcPeers.set(remoteId, pc);
  ensureRemoteSpeaker(remoteId, channelProfiles.get(remoteId));
  return pc;
}

async function publishScreenToPeers() {
  if (!screenStream || !rtcPeers.size) return;
  const [videoTrack] = screenStream.getVideoTracks();
  const [audioTrack] = screenStream.getAudioTracks();
  if (!videoTrack) return;
  for (const [remoteId, pc] of rtcPeers) {
    let sender = pc.getSenders().find(item => item.track?.kind === 'video');
    if (sender) await sender.replaceTrack(videoTrack).catch(() => {});
    else pc.addTrack(videoTrack, screenStream);
    if(audioTrack&&!pc.getSenders().some(item=>item.track===audioTrack))pc.addTrack(audioTrack,screenStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(remoteId, 'offer', pc.localDescription);
  }
}

async function publishMicrophoneToPeers() {
  if (!microphoneStream || !rtcPeers.size) return;
  const [audioTrack] = microphoneStream.getAudioTracks();
  if (!audioTrack) return;
  for (const [remoteId, pc] of rtcPeers) {
    pc.getTransceivers().filter(item => item.receiver?.track?.kind === 'audio').forEach(item => { item.direction = 'sendrecv'; });
    let sender = pc.getSenders().find(item => item.track?.kind === 'audio' || item.track === null);
    if (sender) await sender.replaceTrack(audioTrack).catch(() => {});
    else pc.addTrack(audioTrack, microphoneStream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal(remoteId, 'offer', pc.localDescription);
  }
}

function hostControls(targetId) {
  const controls=document.createElement('div'); controls.className='host-controls'; controls.dataset.targetId=targetId;
  controls.innerHTML='<button data-action="mute" title="Mute"><span class="material-symbols-rounded">mic_off</span></button><button data-action="remove" title="Remove"><span class="material-symbols-rounded">person_remove</span></button><button data-action="ban" title="Ban"><span class="material-symbols-rounded">block</span></button>';
  return controls;
}
function ensureRemoteSpeaker(remoteId, profile=null) {
  if(profile?.uid){
    const byUser=document.querySelector(`.speaker[data-user-id="${CSS.escape(profile.uid)}"]`);
    if(byUser){byUser.dataset.peerId=remoteId;byUser.classList.add('remote-speaker');hydrateSpeakerProfile(byUser,profile);if(isRoomHost&&!byUser.querySelector('.host-controls'))byUser.appendChild(hostControls(remoteId));return;}
  }
  const existing=document.querySelector(`[data-peer-id="${CSS.escape(remoteId)}"]`);
  if(existing){ if(profile) hydrateSpeakerProfile(existing,profile); return; }
  const card=document.createElement('article'); card.className='speaker remote-speaker'; card.dataset.peerId=remoteId;
  card.innerHTML=`<div class="speaker-avatar blue">${profileAvatarMarkup(profile,remoteId.slice(0,2))}<span class="mic-chip">*</span></div><h3></h3><p></p><div class="speaker-actions"><button class="speaker-profile" type="button"><span class="material-symbols-rounded">account_circle</span> Profile</button><button class="add-friend" type="button"><span class="material-symbols-rounded">person_add</span> Add friend</button></div>`;
  hydrateSpeakerProfile(card,profile||{name:'Member',handle:'Live participant'});
  if(isRoomHost) card.appendChild(hostControls(remoteId)); document.getElementById('speakerGrid').appendChild(card);
}
function hydrateSpeakerProfile(card,profile) {
  if(!card||!profile)return;
  card.dataset.userId=profile.uid||'';
  card.dataset.friendId=profile.uid||card.dataset.peerId||'';
  card.dataset.friendName=profile.name||'Member';
  card.dataset.friendHandle=profile.handle||'';
  const avatar=card.querySelector('.speaker-avatar');
  if(avatar) avatar.innerHTML=`${profileAvatarMarkup(profile)}<span class="mic-chip">*</span>`;
  const title=card.querySelector('h3'), meta=card.querySelector('p');
  if(title) title.textContent=profile.name||'Member';
  if(meta) meta.textContent=profile.handle?`${profile.handle} - ${profile.behaviorPoints??5000} pts`:'Live participant';
  const add=card.querySelector('.add-friend');
  if(add) add.hidden=!profile.uid||profile.uid===window.lingoUser?.id;
  const profileButton=card.querySelector('.speaker-profile');
  if(profileButton) profileButton.hidden=!profile.uid;
}
function renderChannelPresence(members=[]) {
  updateSelfSpeakerProfile();
  const remoteMembers=members.filter(member=>member.uid&&member.uid!==window.lingoUser?.id);
  const activeIds=new Set(remoteMembers.map(member=>member.uid));
  document.querySelectorAll('.presence-speaker').forEach(card=>{if(!activeIds.has(card.dataset.userId))card.remove()});
  remoteMembers.forEach(member=>{
    let card=document.querySelector(`.speaker[data-user-id="${CSS.escape(member.uid)}"]`);
    if(!card){
      card=document.createElement('article');
      card.className='speaker presence-speaker';
      card.innerHTML='<div class="speaker-avatar blue"></div><h3></h3><p></p><div class="speaker-actions"><button class="speaker-profile" type="button"><span class="material-symbols-rounded">account_circle</span> Profile</button><button class="add-friend" type="button"><span class="material-symbols-rounded">person_add</span> Add friend</button></div>';
      document.getElementById('speakerGrid').appendChild(card);
    }
    hydrateSpeakerProfile(card,member);
  });
  const count=remoteMembers.length;
  document.querySelector('.listener-count').textContent=count?`${count} real participant${count===1?' is':'s are'} in this channel.`:'Waiting for real participants to join.';
}
function showHostControls() { document.querySelectorAll('.speaker[data-friend-id]').forEach(card=>{if(!card.querySelector('.host-controls'))card.appendChild(hostControls(card.dataset.friendId))}); }

async function handleSignal(message) {
  if(message.type==='moderation') {
    if(message.payload.action==='mute') { microphoneStream?.getAudioTracks().forEach(track=>track.enabled=false); muteButton.setAttribute('aria-pressed','true'); document.getElementById('muteLabel').textContent='Unmute'; showToast('The host muted your microphone'); }
    else { showToast(message.payload.action==='ban'?'You were banned from this channel':'The host removed you from this channel'); leaveRoom(); }
    return;
  }
  if(message.fromProfile) channelProfiles.set(message.from,message.fromProfile);
  const pc = createPeer(message.from);
  ensureRemoteSpeaker(message.from,message.fromProfile||channelProfiles.get(message.from));
  if (message.type === 'offer') {
    await pc.setRemoteDescription(message.payload);
    const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
    await sendSignal(message.from, 'answer', pc.localDescription);
  } else if (message.type === 'answer') {
    await pc.setRemoteDescription(message.payload);
  } else if (message.type === 'ice') {
    await pc.addIceCandidate(message.payload).catch(() => {});
  }
}

async function connectVoiceNetwork() {
  if (rtcRoom) return;
  rtcRoom = activeVoiceRoomKey || document.getElementById('callTitle').textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const response = await fetch('/api/join', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId, room:rtcRoom, limit:activeRoomLimit, user:currentProfile() }) });
  const result = await response.json();
  if(!response.ok) { rtcRoom=null; throw new Error(result.error||'Could not join channel'); }
  const { peers,hostId,peerProfiles={} } = result;
  Object.entries(peerProfiles).forEach(([peer,profile])=>{if(profile)channelProfiles.set(peer,profile)});
  isRoomHost=hostId===clientId; if(isRoomHost) showHostControls();
  signalPoll = setInterval(async () => {
    try {
      const result = await fetch(`/api/signals?client=${encodeURIComponent(clientId)}`);
      const { messages } = await result.json();
      for (const message of messages) await handleSignal(message);
    } catch (_) {}
  }, 300);
  for (const remoteId of peers) {
    ensureRemoteSpeaker(remoteId,channelProfiles.get(remoteId));
    const pc = createPeer(remoteId);
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await sendSignal(remoteId, 'offer', pc.localDescription);
  }
  document.querySelector('.call-status span').textContent = peers.length ? 'Connecting voice...' : 'Waiting for speakers';
}

function watchVoiceActivity(stream) {
  voiceAudioContext?.close();
  cancelAnimationFrame(voiceFrame);
  voiceAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = voiceAudioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  voiceAudioContext.createMediaStreamSource(stream).connect(analyser);
  const levels = new Uint8Array(analyser.frequencyBinCount);
  const selfSpeaker = document.getElementById('selfSpeaker');
  let lastSentAt = 0;
  const detectSpeech = () => {
    analyser.getByteFrequencyData(levels);
    const volume = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    const micOn = muteButton.getAttribute('aria-pressed') === 'false';
    const speaking = micOn && volume > 13;
    selfSpeaker.classList.toggle('voice-active', speaking);
    if (speaking !== lastLocalSpeaking || (speaking && Date.now() - lastSentAt > 1200)) {
      lastLocalSpeaking = speaking;
      lastSentAt = Date.now();
      window.sendLingoVoiceActivity?.(speaking);
      clearTimeout(localSpeakingTimer);
      if (speaking) localSpeakingTimer = setTimeout(() => {
        lastLocalSpeaking = false;
        selfSpeaker.classList.remove('voice-active');
        window.sendLingoVoiceActivity?.(false);
      }, 1500);
    }
    voiceFrame = requestAnimationFrame(detectSpeech);
  };
  detectSpeech();
}

function watchRemoteVoiceActivity(remoteId, stream) {
  const card = document.querySelector(`[data-peer-id="${CSS.escape(remoteId)}"]`);
  if (!card || !stream) return;
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.72;
  context.createMediaStreamSource(stream).connect(analyser);
  const levels = new Uint8Array(analyser.frequencyBinCount);
  const detectSpeech = () => {
    if (!document.body.contains(card) || !stream.active) { context.close().catch(()=>{}); return; }
    analyser.getByteFrequencyData(levels);
    const volume = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    card.classList.toggle('voice-active', volume > 10);
    requestAnimationFrame(detectSpeech);
  };
  detectSpeech();
}

function setRemoteSpeaking(detail) {
  if (!detail || (detail.room !== activeVoiceRoomKey && detail.room !== rtcRoom)) return;
  if (detail.from === window.lingoUser?.id) return;
  const card = document.querySelector(`.speaker[data-user-id="${CSS.escape(detail.from||'')}"]`) || document.querySelector(`[data-peer-id="${CSS.escape(detail.clientId||'')}"]`);
  if (!card) return;
  card.classList.toggle('voice-active', !!detail.speaking);
  clearTimeout(card._voiceActivityTimer);
  if (detail.speaking) card._voiceActivityTimer = setTimeout(() => card.classList.remove('voice-active'), 1800);
}

const chessPiecesStart=[
  'r','n','b','q','k','b','n','r',
  'p','p','p','p','p','p','p','p',
  '','','','','','','','',
  '','','','','','','','',
  '','','','','','','','',
  '','','','','','','','',
  'P','P','P','P','P','P','P','P',
  'R','N','B','Q','K','B','N','R'
];
let chessPieces=[...chessPiecesStart], selectedChessSquare=null, sharedCards=[];
const cardRanks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'], cardSuits=['S','H','D','C'];

const pomodoroSounds={bell:[880,660,880],chime:[523,659,784],soft:[440,554],digital:[988,740,988,1175],zen:[392,523,392],arcade:[784,988,1175,988],birds:[1047,1319,1568],waves:[330,392,330,262],piano:[523,659,784,1047],sparkle:[1175,1568,1760,1568]};
let pomodoroState={status:'ready',duration:25*60,remaining:25*60,sound:'bell',updatedAt:Date.now(),profile:null};
let pomodoroTick=null;
const pomodoroRoomStates=new Map();
function sendActivity(activity,payload={}) { window.sendLingoActivity?.(activity,payload); }
function setActivityTab(name,broadcast=false) {
  document.querySelectorAll('[data-activity-tab]').forEach(button=>button.classList.toggle('active',button.dataset.activityTab===name));
  document.querySelectorAll('[data-activity-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.activityPanel===name));
  if(broadcast)sendActivity('activity-tab',{name});
}
function renderChessBoard() {
  const board=document.getElementById('chessBoard'); if(!board)return;
  board.innerHTML='';
  chessPieces.forEach((piece,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=`chess-square ${((Math.floor(index/8)+index)%2)?'dark':'light'} ${selectedChessSquare===index?'selected':''}`;
    button.textContent=piece;
    button.dataset.index=index;
    board.appendChild(button);
  });
}
function moveChessPiece(from,to,broadcast=false) {
  if(from===to)return;
  chessPieces[to]=chessPieces[from]; chessPieces[from]=''; selectedChessSquare=null; renderChessBoard();
  if(broadcast)sendActivity('chess',{pieces:chessPieces});
}
function resetChessBoard(broadcast=false) { chessPieces=[...chessPiecesStart]; selectedChessSquare=null; renderChessBoard(); if(broadcast)sendActivity('chess',{pieces:chessPieces}); }
function renderCards() {
  const table=document.getElementById('cardTable'); if(!table)return;
  table.innerHTML='';
  if(!sharedCards.length){table.innerHTML='<p>No cards yet. Draw one for the room.</p>';return}
  sharedCards.forEach(card=>{const item=document.createElement('div');item.className=`playing-card ${/[HD]/.test(card)?'red':''}`;item.textContent=card;table.appendChild(item)});
}
function drawSharedCard(broadcast=false) {
  const card=`${cardRanks[Math.floor(Math.random()*cardRanks.length)]}${cardSuits[Math.floor(Math.random()*cardSuits.length)]}`;
  sharedCards=[...sharedCards,card].slice(-24); renderCards(); if(broadcast)sendActivity('cards',{cards:sharedCards});
}
function clearSharedCards(broadcast=false) { sharedCards=[]; renderCards(); if(broadcast)sendActivity('cards',{cards:sharedCards}); }
function drawingContext() { const canvas=document.getElementById('drawingCanvas'); return canvas?.getContext('2d'); }
function drawLine(payload,broadcast=false) {
  const canvas=document.getElementById('drawingCanvas'), context=drawingContext(); if(!canvas||!context||!payload)return;
  context.strokeStyle=payload.color||'#6b8f46'; context.lineWidth=payload.width||4; context.lineCap='round'; context.lineJoin='round';
  context.beginPath(); context.moveTo(payload.x1*canvas.width,payload.y1*canvas.height); context.lineTo(payload.x2*canvas.width,payload.y2*canvas.height); context.stroke();
  if(broadcast)sendActivity('draw',payload);
}
function clearDrawing(broadcast=false) { const canvas=document.getElementById('drawingCanvas'), context=drawingContext(); if(context&&canvas)context.clearRect(0,0,canvas.width,canvas.height); if(broadcast)sendActivity('draw-clear',{}); }
function attachScreenShare(stream,name='A member') {
  const video=document.getElementById('screenShareVideo'), status=document.getElementById('screenShareStatus');
  if(!video)return;
  video.srcObject=stream; video.hidden=false; video.play().catch(()=>{});
  if(status)status.textContent=`${name} is sharing their screen.`;
  setActivityTab('screen',false);
}
async function startScreenShare() {
  if(!navigator.mediaDevices?.getDisplayMedia){showToast('Screen sharing is not supported in this browser');return}
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    screenStream.getAudioTracks().forEach(track=>{track.enabled=false});
    attachScreenShare(screenStream,'You');
    screenStream.getVideoTracks()[0].addEventListener('ended',()=>stopScreenShare(true));
    await connectVoiceNetwork().catch(()=>{});
    await publishScreenToPeers();
    sendActivity('screen-status',{sharing:true,name:window.lingoUser?.name||'A member'});
    document.getElementById('screenShareButton').textContent='Stop sharing';
    const audioButton=document.getElementById('screenAudioButton');if(audioButton){audioButton.disabled=!screenStream.getAudioTracks().length;audioButton.textContent='Unmute device sound'}
  }catch(error){showToast(error.message||'Could not start screen share')}
}
function stopScreenShare(broadcast=false) {
  screenStream?.getTracks().forEach(track=>track.stop()); screenStream=null;
  const video=document.getElementById('screenShareVideo'), status=document.getElementById('screenShareStatus');
  if(video){video.srcObject=null;video.hidden=true}
  if(status)status.textContent='Nobody is sharing right now.';
  document.getElementById('screenShareButton').textContent='Share screen';
  const audioButton=document.getElementById('screenAudioButton');if(audioButton){audioButton.disabled=true;audioButton.textContent='Unmute device sound'}
  if(broadcast)sendActivity('screen-status',{sharing:false});
}
function handleActivity(detail) {
  if(!detail || (detail.room!==activeVoiceRoomKey&&detail.room!==rtcRoom))return;
  const payload=detail.payload||{};
  if(detail.activity==='activity-tab')setActivityTab(payload.name||'chess',false);
  if(detail.activity==='chess'&&Array.isArray(payload.pieces)){chessPieces=payload.pieces.slice(0,64);selectedChessSquare=null;renderChessBoard()}
  if(detail.activity==='cards'&&Array.isArray(payload.cards)){sharedCards=payload.cards.slice(-24);renderCards()}
  if(detail.activity==='draw')drawLine(payload,false);
  if(detail.activity==='draw-clear')clearDrawing(false);
  if(detail.activity==='pomodoro')receivePomodoroState(payload,detail.from);
  if(detail.activity==='screen-status'){const status=document.getElementById('screenShareStatus');if(status)status.textContent=payload.sharing?`${payload.name||'A member'} is sharing their screen.`:'Nobody is sharing right now.';if(payload.sharing)setActivityTab('screen',false)}
}

function formatPomodoro(seconds){seconds=Math.max(0,Math.ceil(Number(seconds)||0));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
function effectivePomodoroRemaining(state){if(state.status!=='running')return state.remaining;return Math.max(0,state.remaining-Math.floor((Date.now()-state.updatedAt)/1000))}
function playPomodoroSound(name='bell'){
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  const context=new AudioContext(),notes=pomodoroSounds[name]||pomodoroSounds.bell;
  notes.forEach((frequency,index)=>{const osc=context.createOscillator(),gain=context.createGain();osc.type=['waves','zen'].includes(name)?'sine':'triangle';osc.frequency.value=frequency;gain.gain.setValueAtTime(0.0001,context.currentTime+index*.16);gain.gain.exponentialRampToValueAtTime(.13,context.currentTime+index*.16+.025);gain.gain.exponentialRampToValueAtTime(0.0001,context.currentTime+index*.16+.22);osc.connect(gain);gain.connect(context.destination);osc.start(context.currentTime+index*.16);osc.stop(context.currentTime+index*.16+.24)});
  setTimeout(()=>context.close().catch(()=>{}),1200);
}
function renderPomodoro(){
  const remaining=effectivePomodoroRemaining(pomodoroState),time=document.getElementById('pomodoroTime'),status=document.getElementById('pomodoroStatus');
  if(time)time.textContent=formatPomodoro(remaining);
  if(status)status.textContent=pomodoroState.status==='running'?'Focusing now':pomodoroState.status==='paused'?'Paused':pomodoroState.status==='done'?'Focus session complete':'Ready to focus';
  if(pomodoroState.status==='running'&&remaining<=0){pomodoroState={...pomodoroState,status:'done',remaining:0,updatedAt:Date.now()};clearInterval(pomodoroTick);pomodoroTick=null;playPomodoroSound(pomodoroState.sound);broadcastPomodoro();showToast('Pomodoro complete - nice focus!')}
  renderPomodoroMembers();
}
function broadcastPomodoro(){
  const profile=currentProfile()||{uid:clientId,name:'Guest',avatar:'',handle:''};
  const payload={...pomodoroState,remaining:effectivePomodoroRemaining(pomodoroState),updatedAt:Date.now(),clientId,profile};
  pomodoroState=payload;pomodoroRoomStates.set(clientId,payload);sendActivity('pomodoro',payload);renderPomodoroMembers();
}
function startPomodoro(){
  const minutes=Math.max(1,Math.min(120,Number(document.getElementById('pomodoroMinutes')?.value)||25)),sound=document.getElementById('pomodoroSound')?.value||'bell';
  pomodoroState={status:'running',duration:minutes*60,remaining:minutes*60,sound,updatedAt:Date.now(),profile:currentProfile(),clientId};
  clearInterval(pomodoroTick);pomodoroTick=setInterval(renderPomodoro,1000);broadcastPomodoro();renderPomodoro();
}
function pausePomodoro(){if(pomodoroState.status!=='running')return;pomodoroState={...pomodoroState,status:'paused',remaining:effectivePomodoroRemaining(pomodoroState),updatedAt:Date.now()};clearInterval(pomodoroTick);pomodoroTick=null;broadcastPomodoro();renderPomodoro()}
function resumePomodoro(){if(!['paused','ready'].includes(pomodoroState.status))return;pomodoroState={...pomodoroState,status:'running',updatedAt:Date.now()};clearInterval(pomodoroTick);pomodoroTick=setInterval(renderPomodoro,1000);broadcastPomodoro();renderPomodoro()}
function restartPomodoro(){clearInterval(pomodoroTick);pomodoroTick=null;pomodoroState={...pomodoroState,status:'ready',remaining:pomodoroState.duration||25*60,updatedAt:Date.now()};broadcastPomodoro();renderPomodoro()}
function receivePomodoroState(payload,from){
  if(!payload?.clientId&&from)payload.clientId=from;
  const id=String(payload.clientId||from||'').slice(0,128);if(!id||id===clientId)return;
  pomodoroRoomStates.set(id,{...payload,clientId:id,receivedAt:Date.now()});renderPomodoroMembers();
}
function renderPomodoroMembers(){
  const list=document.getElementById('pomodoroMembers');if(!list)return;
  const states=[...pomodoroRoomStates.values()].filter(state=>Date.now()-(state.updatedAt||state.receivedAt||0)<2*60*60*1000);
  list.innerHTML='';if(!states.length){list.innerHTML='<p>No timers active yet.</p>';return}
  states.sort((a,b)=>(a.profile?.name||'').localeCompare(b.profile?.name||'')).forEach(state=>{
    const profile=state.profile||{},row=document.createElement('article');row.className=`pomodoro-member ${state.status||'ready'} ${effectivePomodoroRemaining(state)<=0?'done':''}`;
    const avatar=document.createElement(profile.avatar?'img':'div');if(profile.avatar){avatar.src=profile.avatar;avatar.alt=''}else{avatar.className='pomodoro-initials';avatar.textContent=initialsFromName(profile.name||'Member')}
    const copy=document.createElement('div'),name=document.createElement('b'),meta=document.createElement('small'),clock=document.createElement('time');
    name.textContent=state.clientId===clientId?'You':profile.name||'Member';meta.textContent=`${state.status||'ready'} - ${profile.handle||'room member'}`;copy.append(name,meta);clock.textContent=formatPomodoro(effectivePomodoroRemaining(state));row.append(avatar,copy,clock);list.appendChild(row);
  });
}

function appendChatMessage(name, message) {
  const row = document.createElement('div');
  row.className = 'irc-message';
  const time = document.createElement('span');
  time.className = 'irc-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const author = document.createElement('b');
  author.className = name === 'you' ? 'name-you' : 'name-jin';
  author.textContent = name;
  const body = document.createElement('p');
  body.textContent = message;
  row.append(time, author, body);
  ircMessages.appendChild(row);
  ircMessages.scrollTop = ircMessages.scrollHeight;
}

function connectRoomChannel(roomName) {
  roomChannel?.close();
  renderChannelPresence([]);
  window.joinLingoChannel?.(roomName);
  if (!('BroadcastChannel' in window)) return;
  roomChannel = new BroadcastChannel(`lingoloop-${roomName}`);
  roomChannel.addEventListener('message', event => {
    if (event.data?.type === 'chat') appendChatMessage(event.data.name || 'guest', event.data.message);
  });
}

function playRoomSound(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const notes = type === 'join'
    ? [{ frequency: 523.25, start: 0 }, { frequency: 659.25, start: 0.11 }, { frequency: 783.99, start: 0.22 }]
    : [{ frequency: 659.25, start: 0 }, { frequency: 523.25, start: 0.12 }, { frequency: 392, start: 0.24 }];

  notes.forEach(({ frequency, start }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + start);
    oscillator.stop(context.currentTime + start + 0.2);
  });

  setTimeout(() => context.close(), 700);
}

async function joinRoom(card, options={}) {
  const roomKey=card.dataset.roomId||card.querySelector('h3').textContent.toLowerCase().replace(/[^a-z0-9]+/g,'-');
  const requestedLimit=Number(card.dataset.memberLimit||Number(card.dataset.seats||11)+Number(card.dataset.participants||1));
  try {
    const response=await fetch('/api/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,room:roomKey,limit:requestedLimit,user:currentProfile()})});
    const result=await response.json();
    if(!response.ok){showToast(response.status===409?'Group is full':result.error||'Could not join this group');sessionStorage.removeItem('lingoloop-active-room');return}
  } catch (_) { showToast('Could not check group availability'); return; }
  activeVoiceRoomKey=roomKey;
  updateSelfSpeakerProfile();
  if(!options.restored) playRoomSound('join');
  document.getElementById('callTitle').textContent = card.querySelector('h3').textContent;
  document.getElementById('callLanguage').textContent = card.querySelector('.room-language small').textContent;
  document.getElementById('chatTitle').textContent = card.querySelector('h3').textContent;
  activeRoomLimit=requestedLimit;
  connectRoomChannel(roomKey);
  connectVoiceNetwork().catch(() => showToast('Voice is preparing - tap Unmute when you are ready to speak'));
  sessionStorage.setItem('lingoloop-active-room',JSON.stringify({roomKey,title:card.querySelector('h3').textContent}));
  callScreen.classList.add('open');
  callScreen.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function leaveRoom() {
  playRoomSound('exit');
  microphoneStream?.getTracks().forEach(track => track.stop());
  microphoneStream = null;
  cancelAnimationFrame(voiceFrame);
  voiceAudioContext?.close();
  voiceAudioContext = null;
  clearTimeout(localSpeakingTimer);
  if(lastLocalSpeaking) window.sendLingoVoiceActivity?.(false);
  lastLocalSpeaking=false;
  document.getElementById('selfSpeaker').classList.remove('voice-active');
  stopScreenShare(true);
  rtcPeers.forEach((pc, remoteId) => { pc.close(); document.getElementById(`remote-${remoteId}`)?.remove(); });
  rtcPeers.clear();
  channelProfiles.clear();
  clearInterval(signalPoll);
  if (rtcRoom||activeVoiceRoomKey) fetch('/api/leave', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId, room:rtcRoom||activeVoiceRoomKey }) });
  rtcRoom = null;
  activeVoiceRoomKey=null;
  isRoomHost=false;
  roomChannel?.close(); roomChannel=null;
  document.querySelectorAll('.remote-speaker').forEach(card=>card.remove());
  document.querySelectorAll('.presence-speaker').forEach(card=>card.remove());
  document.querySelectorAll('.host-controls').forEach(control=>control.remove());
  document.querySelector('.call-status span').textContent = 'Connected';
  callScreen.classList.remove('open');
  callScreen.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  sessionStorage.removeItem('lingoloop-active-room');
  showToast('You left the room. See you next time!');
}

document.getElementById('speakerGrid').addEventListener('click',async event => {
  const profileButton=event.target.closest('.speaker-profile');
  if(profileButton){const uid=profileButton.closest('.speaker')?.dataset.userId;if(uid)window.openMemberProfile?.(uid);return}
  const button=event.target.closest('.host-controls button'); if(!button) return;
  const controls=button.closest('.host-controls'), action=button.dataset.action, targetId=controls.dataset.targetId;
  const response=await fetch('/api/moderate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:rtcRoom,actorId:clientId,targetId,action})});
  if(!response.ok && rtcPeers.has(targetId)) { showToast('Moderation action could not be completed'); return; }
  const result=await response.json().catch(()=>({}));
  const member=controls.closest('.speaker');
  if(action==='mute') { member.classList.add('moderated-muted'); showToast('Member muted'); }
  else { member.remove(); showToast(action==='ban'?(result.globalIpBanAdded?'Member banned by account and IP':'Member banned from this room'):'Member removed'); }
});

document.getElementById('roomsGrid').addEventListener('click', event => {
  const editButton = event.target.closest('.edit-room');
  const deleteButton = event.target.closest('.delete-room');
  const creatorButton=event.target.closest('.creator-profile');
  if(creatorButton){const creatorId=creatorButton.closest('.room-card').dataset.creatorId;if(creatorId)window.openMemberProfile?.(creatorId);else showToast('This community profile is not available yet');return}
  if (editButton) {
    const card = editButton.closest('.room-card');
    editingRoomId = card.dataset.roomId;
    const room = savedRooms.find(item => item.id === editingRoomId);
    if (!room) return;
    const form = document.getElementById('roomForm');
    form.elements.name.value = room.name;
    form.elements.language.value = room.language;
    form.elements.level.value = room.level || 'All levels';
    form.elements.memberLimit.value = room.memberLimit || 12;
    document.getElementById('modalTitle').textContent = 'Update your channel';
    form.querySelector('button[type="submit"]').textContent = 'Save changes ->';
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    setTimeout(() => form.elements.name.focus(),100);
    return;
  }
  if (deleteButton) {
    const card = deleteButton.closest('.room-card');
    const title = card.querySelector('h3').textContent;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const room=savedRooms.find(item=>item.id===card.dataset.roomId);
    fetch(`/api/channels/${encodeURIComponent(card.dataset.roomId)}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({creatorId:room?.creatorId||window.lingoUser?.id})});
    savedRooms = savedRooms.filter(item => item.id !== card.dataset.roomId);
    localStorage.setItem('lingoloop-rooms',JSON.stringify(savedRooms));
    cards = cards.filter(item => item !== card);
    card.remove(); filterRooms(); showToast(`"${title}" was deleted`);
    return;
  }
  const button = event.target.closest('.join-button');
  if (button) joinRoom(button.closest('.room-card'));
});
document.getElementById('leaveRoom').addEventListener('click', leaveRoom);
muteButton.addEventListener('click', async () => {
  const muted = muteButton.getAttribute('aria-pressed') === 'true';
  if (muted && !microphoneStream) {
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      watchVoiceActivity(microphoneStream);
      await connectVoiceNetwork();
      await publishMicrophoneToPeers();
    } catch (error) {
      showToast(error.message || 'Microphone access is needed for WebRTC voice');
      return;
    }
  }
  microphoneStream?.getAudioTracks().forEach(track => { track.enabled = muted; });
  if (!muted) document.getElementById('selfSpeaker').classList.remove('voice-active');
  muteButton.setAttribute('aria-pressed', String(!muted));
  muteButton.classList.toggle('active', muted);
  document.getElementById('muteIcon').textContent = muted ? 'mic' : 'off';
  document.getElementById('muteLabel').textContent = muted ? 'Mute' : 'Unmute';
  document.getElementById('selfStatus').textContent = muted ? 'Microphone on' : 'Microphone off';
  document.getElementById('selfMicChip').textContent = muted ? '*' : 'x';
  document.getElementById('selfMicChip').classList.toggle('muted', !muted);
});
ircForm.addEventListener('submit', event => {
  event.preventDefault();
  const message = ircInput.value.trim();
  if (!message) return;
  const sent=window.sendLingoChannelMessage?.(message);
  if(!sent) { appendChatMessage('you',message); roomChannel?.postMessage({type:'chat',name:'guest',message}); }
  ircInput.value = '';
  ircInput.focus();
});
window.addEventListener('lingo-channel-message',event=>appendChatMessage(event.detail.senderName||'member',event.detail.text));
window.addEventListener('lingo-channel-presence',event=>{
  if(event.detail.room===activeVoiceRoomKey||event.detail.room===rtcRoom)renderChannelPresence(event.detail.members||[]);
});
window.addEventListener('lingo-channel-voice',event=>setRemoteSpeaking(event.detail));
window.addEventListener('lingo-channel-activity',event=>handleActivity(event.detail));
window.addEventListener('lingo-channel-deleted',event=>{const id=event.detail?.id;if(!id)return;const card=cards.find(item=>item.dataset.roomId===id);if(card){cards=cards.filter(item=>item!==card);savedRooms=savedRooms.filter(room=>room.id!==id);localStorage.setItem('lingoloop-rooms',JSON.stringify(savedRooms));card.remove();filterRooms();showToast(`Channel "${event.detail.name||'room'}" was deleted`) }});
document.querySelectorAll('[data-activity-tab]').forEach(button=>button.addEventListener('click',()=>setActivityTab(button.dataset.activityTab,true)));
document.getElementById('chessBoard')?.addEventListener('click',event=>{
  const square=event.target.closest('.chess-square'); if(!square)return;
  const index=Number(square.dataset.index);
  if(selectedChessSquare===null){if(!chessPieces[index])return;selectedChessSquare=index;renderChessBoard();return}
  moveChessPiece(selectedChessSquare,index,true);
});
document.getElementById('resetChess')?.addEventListener('click',()=>resetChessBoard(true));
document.getElementById('drawCardButton')?.addEventListener('click',()=>drawSharedCard(true));
document.getElementById('clearCardsButton')?.addEventListener('click',()=>clearSharedCards(true));
document.getElementById('clearDrawingButton')?.addEventListener('click',()=>clearDrawing(true));
document.getElementById('screenShareButton')?.addEventListener('click',()=>screenStream?stopScreenShare(true):startScreenShare());
document.getElementById('screenAudioButton')?.addEventListener('click',event=>{if(!screenStream)return;const tracks=screenStream.getAudioTracks();if(!tracks.length)return;const muted=!tracks[0].enabled;tracks.forEach(track=>track.enabled=muted);event.currentTarget.textContent=muted?'Mute device sound':'Unmute device sound';showToast(muted?'Device sound shared':'Device sound muted')});
document.getElementById('pomodoroStart')?.addEventListener('click',startPomodoro);
document.getElementById('pomodoroPause')?.addEventListener('click',pausePomodoro);
document.getElementById('pomodoroResume')?.addEventListener('click',resumePomodoro);
document.getElementById('pomodoroRestart')?.addEventListener('click',restartPomodoro);
document.getElementById('pomodoroPreviewSound')?.addEventListener('click',()=>playPomodoroSound(document.getElementById('pomodoroSound')?.value||'bell'));
document.getElementById('pomodoroMinutes')?.addEventListener('change',event=>{if(pomodoroState.status==='ready'){pomodoroState.duration=Math.max(1,Math.min(120,Number(event.target.value)||25))*60;pomodoroState.remaining=pomodoroState.duration;renderPomodoro()}});
document.getElementById('pomodoroSound')?.addEventListener('change',event=>{pomodoroState.sound=event.target.value});
{
  const canvas=document.getElementById('drawingCanvas');
  let drawing=false,lastPoint=null;
  const point=event=>{const rect=canvas.getBoundingClientRect();const touch=event.touches?.[0]||event;return{x:(touch.clientX-rect.left)/rect.width,y:(touch.clientY-rect.top)/rect.height}};
  canvas?.addEventListener('pointerdown',event=>{drawing=true;lastPoint=point(event);canvas.setPointerCapture?.(event.pointerId)});
  canvas?.addEventListener('pointermove',event=>{if(!drawing||!lastPoint)return;const next=point(event),payload={x1:lastPoint.x,y1:lastPoint.y,x2:next.x,y2:next.y,color:document.getElementById('drawColor')?.value||'#6b8f46',width:4};drawLine(payload,true);lastPoint=next});
  canvas?.addEventListener('pointerup',()=>{drawing=false;lastPoint=null});
  canvas?.addEventListener('pointerleave',()=>{drawing=false;lastPoint=null});
}
renderChessBoard();
renderCards();
renderPomodoro();
setInterval(renderPomodoroMembers,1000);
handButton.addEventListener('click', () => {
  const raised = handButton.getAttribute('aria-pressed') === 'true';
  handButton.setAttribute('aria-pressed', String(!raised));
  handButton.classList.toggle('active', !raised);
  showToast(raised ? 'Hand lowered' : 'Hand raised - the host can see you');
});
document.querySelectorAll('[data-toast]').forEach(button => button.addEventListener('click', () => showToast(button.dataset.toast)));

document.getElementById('roomForm').addEventListener('submit', async event => {
  event.preventDefault();
  if(!window.lingoUser){showToast('Sign in before creating a channel');document.getElementById('authLogin').click();return}
  const data = new FormData(event.currentTarget);
  if (editingRoomId) {
    const room = savedRooms.find(item => item.id === editingRoomId);
    const card = cards.find(item => item.dataset.roomId === editingRoomId);
    if (room && card) {
      room.name = data.get('name').trim(); room.language = data.get('language'); room.level=data.get('level')||'All levels'; room.memberLimit=Number(data.get('memberLimit'));
      const replacement = buildRoomCard(room);
      const position = cards.indexOf(card);
      card.replaceWith(replacement); cards[position] = replacement;
      decorateRoomCard(replacement, position);
      localStorage.setItem('lingoloop-rooms',JSON.stringify(savedRooms));
      await fetch(`/api/channels/${encodeURIComponent(room.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({creatorId:window.lingoUser.id,name:room.name,language:room.language,level:room.level,memberLimit:room.memberLimit})});
      closeModal(); event.currentTarget.reset(); filterRooms();
      showToast(`"${room.name}" was updated`); editingRoomId = null;
      return;
    }
  }
  const room = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
    name: data.get('name').trim(),
    language: data.get('language'),
    level: data.get('level') || 'All levels',
    memberLimit: Number(data.get('memberLimit')),
    createdAt: Date.now(),
    creatorId:window.lingoUser.id,
    creatorName:window.lingoUser.name,
    creatorHandle:window.lingoUser.handle,
    creatorAvatar:window.lingoUser.avatar,
    expiresAt:Date.now()+3*24*60*60*1000
  };
  const channelResponse=await fetch('/api/channels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(room)});if(!channelResponse.ok){showToast('Channel could not be created');return}
  const card = buildRoomCard(room);
  document.getElementById('roomsGrid').prepend(card);
  cards.unshift(card);
  decorateRoomCard(card, cards.length);
  savedRooms.unshift(room);
  localStorage.setItem('lingoloop-rooms', JSON.stringify(savedRooms));
  currentLanguage = 'All';
  filters.forEach(item => item.classList.toggle('active', item.dataset.language === 'All'));
  search.value = '';
  levelFilter.value = 'All';
  availabilityFilter.value = 'All';
  sortFilter.value = 'newest';
  filterRooms();
  closeModal();
  showToast(`"${room.name}" is live - you are the host!`);
  event.currentTarget.reset();
  card.scrollIntoView({ behavior:'smooth', block:'center' });
  syncOwnerControls();
});

try {
  const activeRoom=JSON.parse(sessionStorage.getItem('lingoloop-active-room')||'null');
  if(activeRoom) {
    const card=cards.find(item=>(item.dataset.roomId||item.querySelector('h3').textContent.toLowerCase().replace(/[^a-z0-9]+/g,'-'))===activeRoom.roomKey);
    if(card) setTimeout(()=>joinRoom(card,{restored:true}),0);
    else sessionStorage.removeItem('lingoloop-active-room');
  }
} catch (_) { sessionStorage.removeItem('lingoloop-active-room'); }


