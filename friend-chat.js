const chatPanel=document.getElementById('friendChat'), friendsList=document.getElementById('friendsList');
const directMessages=document.getElementById('directMessages'), directInput=document.getElementById('directInput');
const notificationsPanel=document.getElementById('notificationsPanel'), notificationsList=document.getElementById('notificationsList');
const emojis=[':)','XD','<3',':D','hug','hmm','wow',':(','fire','spark','yay','+1','clap','pray','chat','world','coffee','heart','rocket','wave'];
let friends=[],activeFriend=null,socket=null,reconnectTimer=null,unread=0,currentChannel=null;
let blockedFriends=new Set();
let firebaseSync=null,firebaseThreadKey='',firebaseThreadUnsubscribe=null;
let firebaseChannelRoom='',firebaseChannelUnsubscribe=null;
const seenChannelMessages=new Set();
import('./firebase-sync.js').then(module=>{firebaseSync=module;syncActiveFirebaseThread();syncChannelFirebase()}).catch(()=>{firebaseSync=null});
const guestId=localStorage.getItem('lingoloop-guest-id')||`guest-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
localStorage.setItem('lingoloop-guest-id',guestId);
try{friends=JSON.parse(localStorage.getItem('lingoloop-friends')||'[]')}catch(_){}
try{blockedFriends=new Set(JSON.parse(localStorage.getItem('lingoloop-blocked-friends')||'[]'))}catch(_){}
const demoFriendIds=new Set(['maya','jin','luka','ana']);
if(friends.some(friend=>demoFriendIds.has(friend.id))){friends=friends.filter(friend=>!demoFriendIds.has(friend.id));localStorage.setItem('lingoloop-friends',JSON.stringify(friends))}
let notifications=[];try{notifications=JSON.parse(localStorage.getItem('lingoloop-notifications')||'[]')}catch(_){}
let pendingFriendRequests=0;
let outgoingFriendRequests=new Set();
const me=()=>window.lingoUser||{id:guestId,name:'Guest learner',avatar:''};
const initials=name=>name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
function saveFriends(){localStorage.setItem('lingoloop-friends',JSON.stringify(friends))}
function saveBlockedFriends(){localStorage.setItem('lingoloop-blocked-friends',JSON.stringify([...blockedFriends]))}
function saveNotifications(){localStorage.setItem('lingoloop-notifications',JSON.stringify(notifications.slice(0,80)))}
notifications=notifications.filter(item=>item.from!==me().id);
saveNotifications();
function notificationIcon(kind){return kind==='direct-message'?'chat':kind==='friend-request'?'person_add':kind==='friend-accepted'?'how_to_reg':kind==='channel-join'?'groups':'notifications'}
function addNotification(item){
  const notification={id:item.id||crypto.randomUUID?.()||String(Date.now()),title:item.title||'LingoLoop notification',body:item.body||'',kind:item.notificationKind||item.kind||'general',createdAt:Date.now(),read:false,from:item.from||'',room:item.room||''};
  const existing=notifications.find(entry=>entry.id===notification.id);
  if(existing){Object.assign(existing,notification,{read:existing.read&&notification.read});saveNotifications();renderNotifications();updateBadge();return}
  notifications.unshift(notification);notifications=notifications.slice(0,80);saveNotifications();renderNotifications();updateBadge();
}
function renderNotifications(){
  if(!notificationsList)return;
  notificationsList.innerHTML='';
  const summary=document.getElementById('notificationSummary'), unreadNotifications=notifications.filter(item=>!item.read).length;
  if(summary)summary.textContent=unreadNotifications?`${unreadNotifications} unread notification${unreadNotifications===1?'':'s'}`:'All caught up';
  if(!notifications.length){notificationsList.innerHTML='<p>No notifications yet. Friend requests, messages, and channel joins will appear here.</p>';return}
  notifications.forEach(item=>{const row=document.createElement('article');row.className=`notification-item ${item.read?'read':'unread'}`;row.innerHTML='<span class="material-symbols-rounded"></span><div><b></b><p></p><small></small></div>';row.querySelector('.material-symbols-rounded').textContent=notificationIcon(item.kind);row.querySelector('b').textContent=item.title;row.querySelector('p').textContent=item.body;row.querySelector('small').textContent=new Date(item.createdAt).toLocaleString([], {hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'});row.addEventListener('click',()=>{item.read=true;saveNotifications();if(item.kind==='direct-message'){openChat()}else if(item.kind==='friend-request'||item.kind==='friend-accepted'){openChat();loadFriendRequests()}renderNotifications();updateBadge()});notificationsList.appendChild(row)});
}
function showChatAuthPrompt(){
  document.getElementById('conversationActive').hidden=true;
  const empty=document.getElementById('conversationEmpty');
  empty.hidden=false;
  empty.innerHTML='<span class="material-symbols-rounded">lock_open</span><h3>Sign in to chat with friends</h3><p>Friend requests and private messages need your unique @ID. Log in, then search a friend by @ID.</p><button class="button button-primary" id="chatLoginButton" type="button">Log in</button>';
  document.getElementById('chatLoginButton')?.addEventListener('click',()=>document.getElementById('authLogin')?.click());
}
function resetConversationEmpty(){
  const empty=document.getElementById('conversationEmpty');
  empty.innerHTML='<span class="material-symbols-rounded">waving_hand</span><h3>Choose a friend</h3><p>Your private messages will appear here.</p>';
}
function showInlineLogin(container,message='Sign in first to search and chat with real users.'){
  container.innerHTML=`<div class="search-feedback auth-needed"><p>${message}</p><button class="button button-primary" type="button">Log in</button></div>`;
  container.querySelector('button')?.addEventListener('click',()=>document.getElementById('authLogin')?.click());
}
async function loadFriendRequests(){
  const list=document.getElementById('friendRequestsList'); if(!list) return;
  if(!window.lingoUser){pendingFriendRequests=0;outgoingFriendRequests=new Set();updateBadge();list.innerHTML='<p>Sign in to manage requests and message friends.</p>';return}
  try{
    const response=await fetch(`/api/friend-requests?uid=${encodeURIComponent(me().id)}`),data=await response.json();
    list.innerHTML='';
    const incoming=data.incoming||[],outgoing=data.outgoing||[];
    outgoingFriendRequests=new Set(outgoing.map(request=>request.to));
    pendingFriendRequests=incoming.length;updateBadge();
    const knownRequestIds=new Set(notifications.filter(item=>item.kind==='friend-request').map(item=>item.id));
    incoming.forEach(request=>{if(!knownRequestIds.has(request.id))addNotification({id:request.id,title:'New friend request',body:`${request.fromUser.name} wants to connect with you.`,notificationKind:'friend-request',from:request.from})});
    if(!incoming.length&&!outgoing.length){list.innerHTML='<p>No pending requests.</p>'}
    incoming.forEach(request=>renderFriendRequest(list,request,'incoming'));
    outgoing.forEach(request=>renderFriendRequest(list,request,'outgoing'));
    (data.accepted||[]).forEach(request=>{const other=request.from===me().id?request.toUser:request.fromUser;ensureFriend(other.uid,other.name,other.avatar,other.handle)});
  }catch(_){pendingFriendRequests=0;outgoingFriendRequests=new Set();updateBadge();list.innerHTML='<p>Could not load requests.</p>'}
}
function renderFriendRequest(list,request,kind){
  const user=kind==='incoming'?request.fromUser:request.toUser;
  const row=document.createElement('article');row.className='friend-request-row';
  row.innerHTML='<span class="friend-avatar"></span><div><b></b><small></small></div><div class="request-actions"></div>';
  const avatar=row.querySelector('.friend-avatar'); if(user.avatar){const image=document.createElement('img');image.src=user.avatar;image.alt='';avatar.appendChild(image)}else avatar.textContent=initials(user.name);
  row.querySelector('b').textContent=user.name;row.querySelector('small').textContent=kind==='incoming'?`${user.handle} wants to connect`:`Waiting for ${user.handle}`;
  const actions=row.querySelector('.request-actions');
  if(kind==='incoming'){const accept=document.createElement('button');accept.type='button';accept.textContent='Approve';accept.addEventListener('click',()=>respondFriendRequest(request.id,'accept',user));actions.appendChild(accept)}
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=kind==='incoming'?'Cancel':'Cancel';cancel.addEventListener('click',()=>respondFriendRequest(request.id,kind==='incoming'?'decline':'cancel'));actions.appendChild(cancel);
  list.appendChild(row);
}
async function respondFriendRequest(id,action,user){
  const response=await fetch(`/api/friend-requests/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({actor:me().id,action})});
  if(response.ok&&action==='accept'&&user){ensureFriend(user.uid,user.name,user.avatar,user.handle);activeFriend=friends.find(friend=>friend.id===user.uid);renderFriends();renderConversation();notify(`${user.handle} is now your friend`)}
  await loadFriendRequests();
}
async function requestFriend(user){
  if(!window.lingoUser){notify('Sign in before sending friend requests');return}
  const response=await fetch('/api/friend-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:me().id,to:user.uid})});
  const result=await response.json().catch(()=>({}));
  if(response.ok&&result.request?.status==='accepted'){ensureFriend(user.uid,user.name,user.avatar,user.handle);activeFriend=friends.find(friend=>friend.id===user.uid);renderFriends();renderConversation();notify(`${user.handle} is already your friend`);return}
  if(response.ok){outgoingFriendRequests.add(user.uid);notify(`Friend request sent to ${user.handle}. Waiting for approval.`);loadFriendRequests();return}
  notify(result.error||'Friend request could not be sent');
}
async function findUserByHandle(handle){
  const query=`@${String(handle||'').replace(/^@/,'')}`;
  const response=await fetch(`/api/users/search?q=${encodeURIComponent(query)}`),data=await response.json();
  return (data.users||[]).find(user=>user.handle.toLowerCase()===query.toLowerCase())||null;
}
function connectChat(){
  clearTimeout(reconnectTimer); const protocol=location.protocol==='https:'?'wss':'ws'; socket=new WebSocket(`${protocol}://${location.host}/ws`);
  socket.addEventListener('open',()=>{document.getElementById('socketStatus').textContent='Live - WebSocket';socket.send(JSON.stringify({type:'hello',user:me()}));blockedFriends.forEach(target=>socket.send(JSON.stringify({type:'block-user',target,blocked:true})));if(currentChannel)socket.send(JSON.stringify({type:'join-channel',room:currentChannel}))});
  socket.addEventListener('close',()=>{if(window.lingoNetworkBlocked)return;document.getElementById('socketStatus').textContent='Reconnecting...';reconnectTimer=setTimeout(connectChat,1800)});
  socket.addEventListener('message',event=>handleSocketMessage(JSON.parse(event.data)));
}
function handleSocketMessage(message){
  if(message.type==='direct-message'){
    if(message.from===me().id||message.senderId===me().id)return;
    if(blockedFriends.has(message.from))return;
    ensureFriend(message.from,message.senderName,message.senderAvatar);
    storeMessage(message.from,message);
    addNotification({id:`dm-${message.id}`,title:`Message from ${message.senderName||'Friend'}`,body:message.kind==='file'?'Sent you a file':message.text,notificationKind:'direct-message',from:message.from});
    if(activeFriend?.id===message.from)renderConversation();
    else{unread++;showBrowserNotification({title:`Message from ${message.senderName||'Friend'}`,body:message.kind==='file'?'Sent you a file':message.text,notificationKind:'direct-message'});updateBadge()}
  }else if(message.type==='message-sent'){
    storeMessage(message.to,message);if(activeFriend?.id===message.to)renderConversation()
  }else if(message.type==='message-error'){notify(message.message)}
  else if(message.type==='block-updated'){notify(message.blocked?'Friend blocked':'Friend unblocked')}
  else if(message.type==='channel-message'){firebaseSync?.saveChannelMessage?.(message.room||currentChannel,message).catch(()=>{});dispatchChannelMessage(message)}
  else if(message.type==='channel-presence'){window.dispatchEvent(new CustomEvent('lingo-channel-presence',{detail:message}))}
  else if(message.type==='channel-voice'){window.dispatchEvent(new CustomEvent('lingo-channel-voice',{detail:message}))}
  else if(message.type==='channel-activity'){window.dispatchEvent(new CustomEvent('lingo-channel-activity',{detail:message}))}
  else if(message.type==='channel-deleted'){window.dispatchEvent(new CustomEvent('lingo-channel-deleted',{detail:message}))}
  else if(message.type==='chat-warning'){applyDiscipline(message)}
  else if(message.type==='community-status'){applyCommunityStatus(message)}
  else if(message.type==='access-blocked'){window.lingoNetworkBlocked=true;document.getElementById('socketStatus').textContent='Blocked';notify(message.message||'Access is blocked for this network')}
  else if(message.type==='app-notification'){
    if(message.notificationKind!=='direct-message')addNotification(message);
    if(message.notificationKind!=='direct-message')showBrowserNotification(message);
    if(['friend-request','friend-accepted'].includes(message.notificationKind))loadFriendRequests()
  }
}
function ensureFriend(id,name,avatar='',handle=''){const existing=friends.find(friend=>friend.id===id);if(existing){existing.name=name||existing.name;existing.avatar=avatar||existing.avatar;existing.handle=handle||existing.handle}else friends.push({id,name:name||'Friend',avatar,handle});saveFriends();renderFriends()}
function addFriend(card){if(!card)return;const friend={id:card.dataset.friendId,name:card.dataset.friendName,avatar:card.querySelector('.speaker-avatar img')?.src||'',handle:card.dataset.friendHandle||''};if(!friend.id||friend.id===me().id){notify('This profile is not available for friend chat');return}ensureFriend(friend.id,friend.name,friend.avatar,friend.handle);activeFriend=friends.find(x=>x.id===friend.id);openChat();renderFriends();renderConversation();const button=card.querySelector('.add-friend');if(button){button.innerHTML='<span class="material-symbols-rounded">chat</span> Message';button.classList.add('added')}}
function renderFriends(){friendsList.innerHTML='';if(!window.lingoUser){friendsList.innerHTML='<p>Log in to see approved friends.</p>';return}if(!friends.length){friendsList.innerHTML='<p>Search a real @ID, send a friend request, then chat after approval.</p>';return}friends.forEach(friend=>{const button=document.createElement('button');button.className=`${activeFriend?.id===friend.id?'active ':''}${blockedFriends.has(friend.id)?'blocked':''}`;button.innerHTML=`<span class="friend-avatar">${initials(friend.name)}</span><span><b></b><small></small></span>`;button.querySelector('b').textContent=friend.name;button.querySelector('small').textContent=blockedFriends.has(friend.id)?'Blocked':friend.handle||'Tap to message';button.addEventListener('click',()=>{activeFriend=friend;renderFriends();renderConversation();directInput.focus()});friendsList.appendChild(button)})}
function key(friendId){return`lingoloop-dm-${[me().id,friendId].sort().join('-')}`}
function getMessages(){try{return JSON.parse(localStorage.getItem(key(activeFriend.id))||'[]').sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))}catch(_){return[]}}
function storeMessage(friendId,message,options={}){const storageKey=`lingoloop-dm-${[me().id,friendId].sort().join('-')}`;let messages=[];try{messages=JSON.parse(localStorage.getItem(storageKey)||'[]')}catch(_){}if(messages.some(item=>item.id===message.id))return;const saved={createdAt:Date.now(),...message};messages.push(saved);localStorage.setItem(storageKey,JSON.stringify(messages.slice(-100)));if(!options.fromFirebase)firebaseSync?.saveDirectMessage?.(me().id,friendId,saved).catch(()=>{})}
function mergeFirebaseMessages(friendId,remoteMessages=[]){const storageKey=`lingoloop-dm-${[me().id,friendId].sort().join('-')}`;let local=[];try{local=JSON.parse(localStorage.getItem(storageKey)||'[]')}catch(_){}const map=new Map(local.map(item=>[item.id,item]));remoteMessages.forEach(item=>map.set(item.id,item));localStorage.setItem(storageKey,JSON.stringify([...map.values()].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)).slice(-100)))}
function syncActiveFirebaseThread(){if(!firebaseSync?.ready?.()||!activeFriend||!window.lingoUser)return;const thread=firebaseSync.directThreadId(me().id,activeFriend.id);if(thread===firebaseThreadKey)return;firebaseThreadUnsubscribe?.();firebaseThreadKey=thread;firebaseThreadUnsubscribe=firebaseSync.listenDirectMessages(me().id,activeFriend.id,messages=>{mergeFirebaseMessages(activeFriend.id,messages);if(activeFriend&&firebaseSync.directThreadId(me().id,activeFriend.id)===thread)renderConversation()})}
function dispatchChannelMessage(message){if(!message?.id||seenChannelMessages.has(message.id))return;seenChannelMessages.add(message.id);window.dispatchEvent(new CustomEvent('lingo-channel-message',{detail:message}))}
function syncChannelFirebase(){if(!firebaseSync?.ready?.()||!currentChannel)return;if(firebaseChannelRoom===currentChannel)return;firebaseChannelUnsubscribe?.();firebaseChannelRoom=currentChannel;firebaseChannelUnsubscribe=firebaseSync.listenChannelMessages(currentChannel,messages=>messages.forEach(dispatchChannelMessage))}
function renderConversation(){
  if(!activeFriend)return;
  syncActiveFirebaseThread();
  document.getElementById('conversationEmpty').hidden=true;
  document.getElementById('conversationActive').hidden=false;
  document.getElementById('conversationName').textContent=activeFriend.name;
  document.getElementById('conversationAvatar').textContent=initials(activeFriend.name);
  const blocked=blockedFriends.has(activeFriend.id);
  document.getElementById('conversationRelation').textContent=blocked?'Blocked - messages disabled':activeFriend.handle||'Private conversation';
  document.getElementById('blockFriendButton').classList.toggle('active',blocked);
  document.getElementById('blockFriendButton').querySelector('small').textContent=blocked?'Unblock':'Block';
  directInput.disabled=blocked||scoreLocked;
  document.querySelector('.send-direct').disabled=blocked||scoreLocked;
  directMessages.innerHTML='';
  const scrollToLatest=()=>requestAnimationFrame(()=>{directMessages.scrollTop=directMessages.scrollHeight});
  getMessages().forEach(message=>{
    const mine=message.from===me().id||message.type==='message-sent';
    const bubble=document.createElement('div');
    bubble.className=`direct-message ${mine?'mine':'theirs'}`;
    if(message.kind==='file'){
      bubble.classList.add('file-message','media-message');
      if(message.mime?.startsWith('image/')&&message.fileData){
        const frame=document.createElement('div');
        frame.className='direct-media-frame';
        const image=document.createElement('img');
        image.src=message.fileData;
        image.alt=message.fileName||'Shared image';
        image.loading='lazy';
        image.addEventListener('load',scrollToLatest,{once:true});
        frame.appendChild(image);
        bubble.appendChild(frame);
      }
      const file=document.createElement('a');
      file.className='direct-file-link';
      file.href=message.fileData||'#';
      file.download=message.fileName||'download';
      file.textContent=`File: ${message.fileName||'Shared file'}`;
      bubble.appendChild(file);
    }else{
      bubble.classList.add('text-message');
      const text=String(message.text||'').trim();
      bubble.textContent=text;
      const token='(?:[:;xX][)D(]|<3|heart|coffee|fire|spark|yay|wow|hmm|hug|wave|clap|pray|rocket|world|chat|ok|yes|no|lol)';
      const textEmoji=new RegExp(`^${token}(?:\\s+${token})*$`,'i');
      if(text&&((/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(text)&&text.length<=24)||textEmoji.test(text)))bubble.classList.add('emoji-only');
    }
    directMessages.appendChild(bubble);
  });
  scrollToLatest();
}
function send(payload){if(blockedFriends.has(activeFriend?.id)){notify('Unblock this friend before sending a message');return}if(!activeFriend||socket?.readyState!==WebSocket.OPEN){notify('Chat is reconnecting - try again in a moment');return}const user=me();socket.send(JSON.stringify({type:'direct-message',id:crypto.randomUUID?.()||String(Date.now()),from:user.id,senderId:user.id,to:activeFriend.id,senderName:user.name,senderAvatar:user.avatar,kind:'text',createdAt:Date.now(),...payload}))}
function notify(text){const toast=document.getElementById('toast');toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function showBrowserNotification(message){notify(message.title);if(document.hidden&&'Notification'in window&&Notification.permission==='granted')new Notification(message.title,{body:message.body||'',icon:window.lingoUser?.avatar||'/assets/github-avatar.png',tag:message.notificationKind||'lingoloop'})}
async function enableNotifications(){
  const status=document.getElementById('notificationStatus');if(!('Notification'in window)){if(status)status.textContent='This browser does not support notifications.';return}
  const permission=await Notification.requestPermission();if(permission!=='granted'){if(status)status.textContent='Notifications were not allowed.';return}
  const vapid=document.getElementById('fcmVapidKey')?.value.trim();if(vapid)localStorage.setItem('lingoloop-fcm-vapid',vapid);
  if('serviceWorker'in navigator)await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(()=>{});
  if(window.lingoUser){await fetch('/api/notification-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:me().id,token:`browser-permission:${Date.now()}`})}).catch(()=>{})}
  if(status)status.textContent=vapid?'Notifications enabled. FCM VAPID key saved for full push setup.':'Notifications enabled for this browser. Add VAPID key for full FCM token setup.';
}
async function requestDesktopNotificationsOnLogin(){if(!window.lingoUser||!('Notification'in window))return;const key=`lingoloop-notification-asked-${window.lingoUser.id}`;if(localStorage.getItem(key))return;localStorage.setItem(key,'1');if(Notification.permission==='default')await Notification.requestPermission().catch(()=>{})}
let disciplineTimer=null,scoreLocked=false;
function setTextChatDisabled(disabled){directInput.disabled=disabled||blockedFriends.has(activeFriend?.id);document.getElementById('ircInput').disabled=disabled;document.querySelector('.send-direct').disabled=disabled||blockedFriends.has(activeFriend?.id);const channelSend=document.querySelector('#ircForm button[type="submit"]');if(channelSend)channelSend.disabled=disabled}
function applyCommunityStatus(status){
  if(status.points!==undefined){document.querySelectorAll('[data-behavior-points]').forEach(element=>element.textContent=status.points);scoreLocked=status.points<2000||status.scoreBlocked;document.querySelectorAll('.behavior-status').forEach(element=>element.classList.toggle('locked',scoreLocked));if(scoreLocked)setTextChatDisabled(true)}
  if(status.strikes!==undefined)document.querySelectorAll('.strike-status b').forEach(element=>element.textContent=`${status.strikes}/3`);
}
function applyDiscipline(warning){
  applyCommunityStatus(warning);
  document.querySelectorAll('.strike-status b').forEach(element=>element.textContent=`${warning.strikes}/3`);
  document.querySelectorAll('.strike-status').forEach(element=>element.classList.toggle('danger',warning.strikes>0));
  window.dispatchEvent(new CustomEvent('lingo-chat-warning',{detail:warning}));
  clearInterval(disciplineTimer);
  if(warning.suspendedUntil>Date.now()){
    const update=()=>{const remaining=Math.max(0,warning.suspendedUntil-Date.now());if(!remaining){clearInterval(disciplineTimer);setTextChatDisabled(scoreLocked);document.querySelectorAll('.strike-status').forEach(element=>{element.innerHTML='Safety strikes: <b>0/3</b>';element.classList.remove('danger')});return}const minutes=Math.floor(remaining/60000),seconds=Math.floor((remaining%60000)/1000);document.querySelectorAll('.strike-status').forEach(element=>element.innerHTML=`Suspended: <b>${minutes}:${String(seconds).padStart(2,'0')}</b>`)};
    setTextChatDisabled(true);update();disciplineTimer=setInterval(update,1000);notify('3/3 strikes - chat suspended for 30 minutes');
  } else if(warning.scoreBlocked)notify('Your behaviour score is below 2,000. Text chat is locked; voice remains available.');
  else notify(`Warning ${warning.strikes}/3 - inappropriate language was changed to **** (-200 points)`);
}
function openChat(){chatPanel.classList.add('open');chatPanel.setAttribute('aria-hidden','false');unread=0;updateBadge();if(!window.lingoUser)showChatAuthPrompt();else loadFriendRequests()}
function openNotifications(){notificationsPanel.classList.add('open');notificationsPanel.setAttribute('aria-hidden','false');renderNotifications()}
function closeNotifications(){notificationsPanel.classList.remove('open');notificationsPanel.setAttribute('aria-hidden','true')}
function updateBadge(){
  const badge=document.getElementById('messageBadge'),notificationBadge=document.getElementById('notificationBadge'),unreadNotifications=notifications.filter(item=>!item.read).length;
  const messageCount=unread+pendingFriendRequests;
  if(badge){badge.hidden=!messageCount;badge.textContent=messageCount>99?'99+':messageCount}
  if(notificationBadge){notificationBadge.hidden=!unreadNotifications;notificationBadge.textContent=unreadNotifications>99?'99+':unreadNotifications}
}
document.addEventListener('click',event=>{const button=event.target.closest('.add-friend');if(button)addFriend(button.closest('.speaker'))});
document.getElementById('blockFriendButton').addEventListener('click',()=>{if(!activeFriend)return;const blocked=!blockedFriends.has(activeFriend.id);if(blocked)blockedFriends.add(activeFriend.id);else blockedFriends.delete(activeFriend.id);saveBlockedFriends();if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'block-user',target:activeFriend.id,blocked}));renderFriends();renderConversation()});
document.getElementById('viewFriendProfileButton').addEventListener('click',()=>{if(activeFriend)window.openMemberProfile?.(activeFriend.id)});
document.getElementById('unfriendButton').addEventListener('click',()=>{if(!activeFriend)return;const friend=activeFriend;if(!confirm(`Unfriend ${friend.name}?`))return;friends=friends.filter(item=>item.id!==friend.id);saveFriends();activeFriend=null;document.getElementById('conversationActive').hidden=true;document.getElementById('conversationEmpty').hidden=false;renderFriends();notify(`${friend.name} was removed from your friends`)});
document.getElementById('messagesFab').addEventListener('click',openChat);document.getElementById('closeFriendChat').addEventListener('click',()=>{chatPanel.classList.remove('open');chatPanel.setAttribute('aria-hidden','true')});
document.getElementById('notificationsFab')?.addEventListener('click',openNotifications);
document.getElementById('closeNotifications')?.addEventListener('click',closeNotifications);
document.getElementById('markNotificationsRead')?.addEventListener('click',()=>{notifications.forEach(item=>item.read=true);saveNotifications();renderNotifications();updateBadge()});
document.getElementById('clearNotifications')?.addEventListener('click',()=>{notifications=[];saveNotifications();renderNotifications();updateBadge()});
document.getElementById('userSearchForm').addEventListener('submit',async event=>{
  event.preventDefault();const input=document.getElementById('userSearchInput'),results=document.getElementById('userSearchResults');
  if(!window.lingoUser){showInlineLogin(results);showChatAuthPrompt();return}
  const query=`@${input.value.trim().replace(/^@/,'')}`;if(query.length<2){results.innerHTML='<p class="search-feedback">Enter an @ID to search.</p>';return}
  results.innerHTML='<p class="search-feedback">Searching...</p>';
  try{
    const response=await fetch(`/api/users/search?q=${encodeURIComponent(query)}`),data=await response.json();
    const users=(data.users||[]).filter(user=>user.uid!==me().id);results.innerHTML='';
    if(!users.length){results.innerHTML='<p class="search-feedback">No user found with that ID.</p>';return}
    users.forEach(user=>{const row=document.createElement('button');row.type='button';row.className='user-result';const isFriend=friends.some(friend=>friend.id===user.uid),isPending=outgoingFriendRequests.has(user.uid);const avatar=document.createElement('div');avatar.className='friend-avatar';if(user.avatar){const image=document.createElement('img');image.src=user.avatar;image.alt='';avatar.appendChild(image)}else avatar.textContent=initials(user.name);const copy=document.createElement('span'),name=document.createElement('b'),handle=document.createElement('small');name.textContent=user.name;handle.textContent=isFriend?'Tap to open chat':isPending?'Request sent - waiting approval':`${user.handle} - tap to request`;copy.append(name,handle);const add=document.createElement('span');add.className='user-result-action';add.title=isFriend?`Chat with ${user.handle}`:isPending?'Request pending':`Add ${user.handle}`;add.innerHTML=`<span class="material-symbols-rounded">${isFriend?'chat':isPending?'hourglass_top':'person_add'}</span>`;row.addEventListener('click',()=>{if(isFriend){activeFriend=friends.find(friend=>friend.id===user.uid);renderFriends();renderConversation();results.innerHTML='';directInput.focus()}else if(isPending){notify(`Friend request to ${user.handle} is waiting for approval`)}else requestFriend(user)});row.append(avatar,copy,add);results.appendChild(row)})
  }catch(_){results.innerHTML='<p class="search-feedback">Search is unavailable. Try again.</p>'}
});
document.getElementById('directForm').addEventListener('submit',async event=>{event.preventDefault();const text=directInput.value.trim();if(!text)return;const mention=text.match(/^@([a-zA-Z0-9_.]{3,30})(?:\s+([\s\S]+))?$/);if(mention){const user=await findUserByHandle(mention[1]);if(!user){notify('No user found with that @ID');return}let friend=friends.find(item=>item.id===user.uid);if(!friend){await requestFriend(user);directInput.value='';return}activeFriend=friend;renderFriends();renderConversation();const message=mention[2]?.trim();if(message)send({text:message});directInput.value='';return}if(!activeFriend){notify('Choose a friend or type @their_id message');return}send({text});directInput.value=''});
const emojiPicker=document.getElementById('emojiPicker');emojis.forEach(emoji=>{const button=document.createElement('button');button.type='button';button.textContent=emoji;button.addEventListener('click',()=>{directInput.value+=emoji;directInput.focus()});emojiPicker.appendChild(button)});
document.getElementById('emojiButton').addEventListener('click',()=>emojiPicker.hidden=!emojiPicker.hidden);
document.getElementById('fileButton').addEventListener('click',()=>document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;if(file.size>2*1024*1024){notify('Files must be smaller than 2 MB');event.target.value='';return}const reader=new FileReader();reader.onload=()=>{send({kind:'file',fileName:file.name,mime:file.type,fileData:reader.result});event.target.value=''};reader.readAsDataURL(file)});
document.getElementById('refreshFriendRequests')?.addEventListener('click',loadFriendRequests);
document.getElementById('enableNotifications')?.addEventListener('click',enableNotifications);
const savedVapid=localStorage.getItem('lingoloop-fcm-vapid');if(savedVapid&&document.getElementById('fcmVapidKey'))document.getElementById('fcmVapidKey').value=savedVapid;
window.addEventListener('lingo-auth-changed',()=>{activeFriend=null;firebaseThreadUnsubscribe?.();firebaseThreadUnsubscribe=null;firebaseThreadKey='';document.getElementById('conversationActive').hidden=true;document.getElementById('conversationEmpty').hidden=false;resetConversationEmpty();renderFriends();socket?.close();connectChat();loadFriendRequests();requestDesktopNotificationsOnLogin()});renderFriends();renderNotifications();updateBadge();connectChat();loadFriendRequests();
window.joinLingoChannel=room=>{currentChannel=room;syncChannelFirebase();if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'join-channel',room}))};
window.sendLingoChannelMessage=text=>{if(socket?.readyState!==WebSocket.OPEN)return false;const user=me();const message={type:'channel-message',id:crypto.randomUUID?.()||String(Date.now()),room:currentChannel,senderId:user.id,senderName:user.name,text,createdAt:Date.now()};firebaseSync?.saveChannelMessage?.(currentChannel,message).catch(()=>{});socket.send(JSON.stringify(message));return true};
window.sendLingoVoiceActivity=speaking=>{if(socket?.readyState!==WebSocket.OPEN||!currentChannel)return false;socket.send(JSON.stringify({type:'channel-voice',room:currentChannel,clientId:sessionStorage.getItem('lingoloop-voice-client-id')||'',speaking:!!speaking}));return true};
window.sendLingoActivity=(activity,payload={})=>{if(socket?.readyState!==WebSocket.OPEN||!currentChannel)return false;socket.send(JSON.stringify({type:'channel-activity',room:currentChannel,activity,payload}));return true};

