import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithRedirect, getRedirectResult, GoogleAuthProvider, updateProfile, onAuthStateChanged, signOut, linkWithPopup, linkWithCredential, updatePassword, reauthenticateWithCredential, EmailAuthProvider, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getDatabase, ref, set, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

const configured = !firebaseConfig.apiKey.startsWith('YOUR_');
const currentHost = location.hostname.toLowerCase();
const isLoopbackIp = currentHost === '127.0.0.1';
const isLocalhost = currentHost === 'localhost' || isLoopbackIp;
const isProductionHost = ['lingoloop.space','www.lingoloop.space'].includes(currentHost);
if(isLoopbackIp){
  location.replace(`http://localhost:${location.port||4173}${location.pathname}${location.search}${location.hash}`);
}
const authBackdrop = document.getElementById('authBackdrop');
const profileBackdrop = document.getElementById('profileBackdrop');
const authForm = document.getElementById('authForm');
const tabs = [...document.querySelectorAll('[data-auth-mode]')];
const profileChip = document.getElementById('profileChip');
const openMyProfileShortcut = document.getElementById('openMyProfileShortcut');
const locationPrompt = document.getElementById('locationPermissionPrompt');
const locationPermissionText = document.getElementById('locationPermissionText');
let pendingLocationContext = null;
const promptedLocationUsers = new Set();
let mode = 'login';
let auth = null;
let database = null;

const avatarSeeds = ['Milo','Luna','Koda','Zuri','Nori','Pico','Sage','Mika'];
const avatarUrl = seed => `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
const randomAvatar = () => avatarUrl(`${avatarSeeds[Math.floor(Math.random()*avatarSeeds.length)]}-${crypto.getRandomValues(new Uint32Array(1))[0]}`);

function toast(message) {
  const element = document.getElementById('toast'); element.textContent = message; element.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 3000);
}
function open(backdrop) { backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden','false'); }
function close(backdrop) { backdrop.classList.remove('open'); backdrop.setAttribute('aria-hidden','true'); }
function openAuthModal(next='login'){setMode(next);open(authBackdrop);setTimeout(()=>document.getElementById('googleAuth')?.focus(),80)}
function providerIds(user=auth?.currentUser){return user?.providerData.map(provider=>provider.providerId)||[]}
function updateSettingsState(){const user=auth?.currentUser;if(!user)return;const hasPassword=providerIds(user).includes('password'),hasGoogle=providerIds(user).includes('google.com');document.getElementById('currentPasswordField').hidden=!hasPassword;document.getElementById('currentPassword').required=hasPassword;document.getElementById('passwordModeHelp').textContent=hasPassword?'Change your existing password.':'Create a password so you can also sign in with email.';document.getElementById('providerStatus').textContent=hasGoogle?'Google is connected to this account.':'Google is not connected yet.';document.getElementById('linkGoogleAccount').disabled=hasGoogle}
function setMode(next) {
  mode = next; tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
  document.getElementById('usernameField').hidden = mode !== 'signup';
  document.getElementById('authUsername').required = mode === 'signup';
  document.querySelector('.auth-submit').textContent = mode === 'signup' ? 'Create account' : 'Log in';
  document.getElementById('authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
}
function requireConfig() {
  if (configured) return true;
  toast('Add your Firebase configuration in firebase-config.js'); return false;
}
function useAuthorizedLocalhostForGoogle(){
  if(!isLoopbackIp)return false;
  const next=`http://localhost:${location.port||4173}${location.pathname}${location.search}${location.hash}`;
  toast('Google login needs localhost instead of 127.0.0.1. Redirecting...');
  setTimeout(()=>location.replace(next),700);
  return true;
}
function authDomainHelp(){
  const host=location.hostname;
  if(isProductionHost)return `Firebase blocks ${host}. Add ${host} in Firebase Auth authorized domains.`;
  if(isLocalhost)return 'Firebase blocks this domain. Use http://localhost:4173 and make sure localhost is in Firebase Auth authorized domains.';
  return `Firebase blocks ${host}. Add ${host} in Firebase Auth authorized domains.`;
}
function googleProvider(){
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  return provider;
}
async function finishGoogleUser(user,message='Welcome back'){
  if(!user.photoURL)await updateProfile(user,{photoURL:randomAvatar()});
  await showUser(user);
  close(authBackdrop);
  toast(message);
}
async function redirectToGoogle(provider){
  sessionStorage.setItem('lingo-google-auth-origin',location.origin);
  sessionStorage.setItem('lingo-google-auth-path',`${location.pathname}${location.search}${location.hash}`);
  toast('Opening Google sign-in on this domain...');
  await signInWithRedirect(auth,provider);
}
async function getIdentity(user) {
  const name = user.displayName || user.email.split('@')[0];
  const avatar = user.photoURL || avatarUrl(name);
  const response=await fetch('/api/users/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:user.uid,name,firstName:name.split(/\s+/)[0],avatar})});
  if(!response.ok)throw new Error('Could not create your unique ID');
  return response.json();
}
async function recordLoginMetadata(user,identity){
  if(!database||!user?.uid)return;
  const sessionKey=`lingoloop-login-metadata-${user.uid}`;
  if(sessionStorage.getItem(sessionKey))return;
  try{
    const response=await fetch('/api/session-metadata');
    const metadata=await response.json();
    const payload={
      uid:user.uid,
      email:user.email||'',
      name:identity?.name||user.displayName||'',
      handle:identity?.handle||'',
      ip:metadata.ip||'',
      ipType:metadata.ipType||'',
      country:metadata.country||'Unknown',
      countryCode:metadata.countryCode||'',
      region:metadata.region||'',
      city:metadata.city||'',
      area:metadata.area||'',
      timezone:metadata.timezone||'',
      lookupSource:metadata.source||'',
      lookupError:metadata.lookupError||'',
      userAgent:navigator.userAgent,
      browserLanguage:navigator.language,
      capturedAt:serverTimestamp()
    };
    await set(ref(database,`userLoginMetadata/${user.uid}/latest`),payload);
    await set(push(ref(database,`userLoginMetadata/${user.uid}/events`)),payload);
    sessionStorage.setItem(sessionKey,'1');
  }catch(error){console.warn('Could not save login metadata',error)}
}
async function locationPermissionState(){
  if(!navigator.permissions?.query)return 'unknown';
  try{return (await navigator.permissions.query({name:'geolocation'})).state}catch{return 'unknown'}
}
function showLocationPrompt(user,identity,message){
  if(!locationPrompt)return;
  pendingLocationContext={user,identity};
  locationPermissionText.textContent=message;
  locationPrompt.hidden=false;
}
function hideLocationPrompt(){if(locationPrompt)locationPrompt.hidden=true}
async function saveBrowserLocation(user,identity,permission,coords=null,errorMessage=''){
  if(!database||!user?.uid)return;
  const payload={
    uid:user.uid,
    email:user.email||'',
    name:identity?.name||user.displayName||'',
    handle:identity?.handle||'',
    permission,
    error:errorMessage,
    userAgent:navigator.userAgent,
    browserLanguage:navigator.language,
    capturedAt:serverTimestamp()
  };
  if(coords){
    payload.latitude=Number(coords.latitude.toFixed(2));
    payload.longitude=Number(coords.longitude.toFixed(2));
    payload.accuracyMeters=Math.round(coords.accuracy||0);
    payload.precision='rounded_2_decimal_places';
  }
  await set(ref(database,`userLoginMetadata/${user.uid}/browserLocation/latest`),payload);
  await set(push(ref(database,`userLoginMetadata/${user.uid}/browserLocation/events`)),payload);
}
async function requestBrowserLocation(user=auth?.currentUser,identity=window.lingoUser){
  if(!user)return;
  if(!navigator.geolocation){
    showLocationPrompt(user,identity,'This browser does not support location permission. LingoLoop will keep using IP-based country/area metadata.');
    return;
  }
  hideLocationPrompt();
  return new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(async position=>{
      try{await saveBrowserLocation(user,identity,'granted',position.coords);toast('Location permission saved for safety stats')}catch(error){console.warn('Could not save browser location',error)}
      resolve(true);
    },async error=>{
      const denied=error.code===error.PERMISSION_DENIED;
      try{await saveBrowserLocation(user,identity,denied?'denied':'unavailable',null,error.message)}catch(saveError){console.warn('Could not save location status',saveError)}
      showLocationPrompt(user,identity,denied?'Location is blocked in your browser. Enable it in site settings, then tap Allow again.':'Location could not be detected. Tap Allow to try again.');
      resolve(false);
    },{enableHighAccuracy:false,timeout:9000,maximumAge:600000});
  });
}
async function promptForLocationIfNeeded(user,identity){
  if(!user?.uid||promptedLocationUsers.has(user.uid))return;
  promptedLocationUsers.add(user.uid);
  const state=await locationPermissionState();
  if(state==='granted'){requestBrowserLocation(user,identity);return}
  const message=state==='denied'
    ? 'Location is blocked in your browser. Enable it in site settings, then tap Allow again.'
    : 'Please allow location so LingoLoop can save country and area metadata for moderation and trend stats. We store rounded coordinates only.';
  showLocationPrompt(user,identity,message);
  if(state==='prompt'||state==='unknown')setTimeout(()=>requestBrowserLocation(user,identity),500);
}
async function showUser(user) {
  const name = user.displayName || user.email.split('@')[0];
  const avatar = user.photoURL || avatarUrl(name);
  let identity;
  try{identity=await getIdentity(user)}catch(error){toast(error.message);identity={uid:user.uid,name,avatar,handle:''}}
  document.getElementById('headerName').textContent = name;
  document.getElementById('headerName').title = identity.handle || '';
  document.getElementById('headerAvatar').src = avatar;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = user.email || 'Google account';
  document.getElementById('profileAvatar').src = avatar;
  document.getElementById('profileHandle').value = (identity.handle || '').replace(/^@/,'');
  profileChip.hidden = false;
  if (openMyProfileShortcut) openMyProfileShortcut.hidden = false;
  document.getElementById('authLogin').hidden = true;
  document.getElementById('openSignup').hidden = true;
  document.body.classList.add('logged-in');
  window.lingoUser = { id:user.uid, name, avatar, handle:identity.handle };
  recordLoginMetadata(user,identity);
  promptForLocationIfNeeded(user,identity);
  window.dispatchEvent(new CustomEvent('lingo-auth-changed',{detail:window.lingoUser}));
}

document.getElementById('authLogin').addEventListener('click', () => openAuthModal('login'));
document.getElementById('openSignup').addEventListener('click', () => openAuthModal('signup'));
document.getElementById('closeAuth').addEventListener('click', () => close(authBackdrop));
document.getElementById('closeProfile').addEventListener('click', () => close(profileBackdrop));
profileChip.addEventListener('click', () => open(profileBackdrop));
[authBackdrop,profileBackdrop].forEach(backdrop => backdrop.addEventListener('click', event => { if(event.target===backdrop) close(backdrop); }));
tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.authMode)));
document.getElementById('allowLocationNow')?.addEventListener('click',()=>requestBrowserLocation(pendingLocationContext?.user||auth?.currentUser,pendingLocationContext?.identity||window.lingoUser));
document.getElementById('dismissLocationPrompt')?.addEventListener('click',hideLocationPrompt);

const picker = document.getElementById('avatarPicker');
avatarSeeds.forEach(seed => {
  const button = document.createElement('button'); button.type='button'; button.setAttribute('aria-label',`Use ${seed} avatar`);
  const image = document.createElement('img'); image.src=avatarUrl(seed); image.alt=''; button.appendChild(image);
  button.addEventListener('click', async () => {
    if (!auth?.currentUser) return;
    await updateProfile(auth.currentUser,{photoURL:image.src}); await showUser(auth.currentUser); toast('Avatar updated');
  }); picker.appendChild(button);
});
document.getElementById('profilePhotoUpload')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];if(!file||!auth?.currentUser)return;
  if(file.size>512*1024){toast('Use an image smaller than 512 KB for now');event.target.value='';return}
  const reader=new FileReader();
  reader.onload=async()=>{try{await updateProfile(auth.currentUser,{photoURL:reader.result});await showUser(auth.currentUser);toast('Profile picture updated')}catch(error){toast(error.message.replace('Firebase: ',''))}finally{event.target.value=''}};
  reader.readAsDataURL(file);
});

if (configured) {
  const app = initializeApp(firebaseConfig); auth = getAuth(app); database = getDatabase(app);
  setPersistence(auth,browserLocalPersistence).catch(error=>console.warn('Auth persistence failed',error));
  onAuthStateChanged(auth, async user => { if(user) await showUser(user); else { document.body.classList.remove('logged-in'); window.lingoUser=null; window.dispatchEvent(new CustomEvent('lingo-auth-changed',{detail:null})); profileChip.hidden=true;if(openMyProfileShortcut)openMyProfileShortcut.hidden=true; document.getElementById('authLogin').hidden=false; document.getElementById('openSignup').hidden=false; } });
  getRedirectResult(auth).then(async result=>{if(!result?.user)return;sessionStorage.removeItem('lingo-google-auth-origin');sessionStorage.removeItem('lingo-google-auth-path');await finishGoogleUser(result.user,'Welcome back')}).catch(error=>toast(error.code==='auth/unauthorized-domain'?authDomainHelp():error.message.replace('Firebase: ','')));
  document.getElementById('authNote').hidden = true;
}

authForm.addEventListener('submit', async event => {
  event.preventDefault(); if(!requireConfig()) return;
  const email=document.getElementById('authEmail').value.trim(), password=document.getElementById('authPassword').value;
  try {
    if(mode==='signup') {
      const result=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(result.user,{displayName:document.getElementById('authUsername').value.trim(),photoURL:randomAvatar()}); await showUser(result.user);
      toast('Account created - welcome to LingoLoop!');
    } else await signInWithEmailAndPassword(auth,email,password);
    close(authBackdrop); authForm.reset();
  } catch(error) { toast(error.message.replace('Firebase: ','').replace(/\s*\(auth\/.*\)\.?$/,'')); }
});
document.getElementById('googleAuth').addEventListener('click', async () => {
  if(!requireConfig()) return;
  if(useAuthorizedLocalhostForGoogle())return;
  const button=document.getElementById('googleAuth');
  const provider=googleProvider();
  const wasLinking=!!auth.currentUser;
  try {
    button.disabled=true;
    button.textContent=wasLinking?'Opening Google...':'Redirecting to Google...';
    if(!wasLinking){
      await redirectToGoogle(provider);
      return;
    }
    const result=await linkWithPopup(auth.currentUser,provider);
    await finishGoogleUser(result.user,wasLinking?'Google connected to your account':'Welcome back');
  } catch(error){
    if(error.code==='auth/account-exists-with-different-credential'){
      const email=error.customData?.email||document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
      if(!password){document.getElementById('authEmail').value=email;toast('This email already has an account. Enter its password, then tap Google again.');return}
      try{const signedIn=await signInWithEmailAndPassword(auth,email,password),credential=GoogleAuthProvider.credentialFromError(error);if(credential)await linkWithCredential(signedIn.user,credential);await showUser(signedIn.user);close(authBackdrop);toast('Google linked to your existing account')}catch(linkError){toast(linkError.message.replace('Firebase: ',''))}
    }else if(error.code==='auth/unauthorized-domain')toast(authDomainHelp());
    else if(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request'].includes(error.code)&&!auth.currentUser){
      await redirectToGoogle(provider);
      return;
    }
    else toast(error.message.replace('Firebase: ',''));
  } finally {
    button.disabled=false;
    button.innerHTML='<span class="google-g">G</span> Continue with Google';
  }
});
window.openLingoAuth=openAuthModal;
document.getElementById('signOutButton').addEventListener('click', async () => { if(auth) await signOut(auth); close(profileBackdrop); toast('Signed out'); });
const settingsPage=document.getElementById('settingsPage');
const notificationSettingsPagelet=document.getElementById('notificationSettingsPagelet');
document.getElementById('openSettings').addEventListener('click',()=>{if(!auth?.currentUser)return;close(profileBackdrop);updateSettingsState();settingsPage.classList.add('open');settingsPage.setAttribute('aria-hidden','false');notificationSettingsPagelet?.classList.add('open');notificationSettingsPagelet?.setAttribute('aria-hidden','false');location.hash='settings'});
document.getElementById('closeSettings').addEventListener('click',()=>{settingsPage.classList.remove('open');settingsPage.setAttribute('aria-hidden','true');notificationSettingsPagelet?.classList.remove('open');notificationSettingsPagelet?.setAttribute('aria-hidden','true');history.replaceState(null,'','#rooms')});
document.getElementById('linkGoogleAccount').addEventListener('click',async()=>{try{await linkWithPopup(auth.currentUser,new GoogleAuthProvider());updateSettingsState();toast('Google sign-in connected')}catch(error){if(error.code!=='auth/popup-closed-by-user')toast(error.message.replace('Firebase: ',''))}});
document.getElementById('passwordSettingsForm').addEventListener('submit',async event=>{event.preventDefault();const user=auth?.currentUser;if(!user?.email)return toast('This account has no email address');const current=document.getElementById('currentPassword').value,next=document.getElementById('newPassword').value,confirm=document.getElementById('confirmPassword').value;if(next!==confirm)return toast('New passwords do not match');try{if(providerIds(user).includes('password')){await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,current));await updatePassword(user,next);toast('Password changed successfully')}else{await linkWithCredential(user,EmailAuthProvider.credential(user.email,next));toast('Password created - email sign-in is now available')}event.currentTarget.reset();updateSettingsState()}catch(error){const messages={'auth/wrong-password':'Current password is incorrect','auth/invalid-credential':'Current password is incorrect','auth/requires-recent-login':'Please sign out and sign in again before changing your password','auth/credential-already-in-use':'That email credential belongs to another account'};toast(messages[error.code]||error.message.replace('Firebase: ',''))}});
document.getElementById('handleForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!auth?.currentUser)return;
  const input=document.getElementById('profileHandle'),button=event.currentTarget.querySelector('button');button.disabled=true;
  try{
    const response=await fetch(`/api/users/${encodeURIComponent(auth.currentUser.uid)}/handle`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:`@${input.value.trim().replace(/^@/,'')}`})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save ID');
    input.value=result.handle.slice(1);window.lingoUser={...window.lingoUser,handle:result.handle};window.dispatchEvent(new CustomEvent('lingo-auth-changed',{detail:window.lingoUser}));toast(`Your ID is now ${result.handle}`);
  }catch(error){toast(error.message)}finally{button.disabled=false}
});

const themeToggle=document.getElementById('themeToggle');
function applyTheme(theme){ document.documentElement.dataset.theme=theme; localStorage.setItem('lingoloop-theme',theme); themeToggle.querySelector('span').textContent=theme==='dark'?'light_mode':'dark_mode'; }
applyTheme(localStorage.getItem('lingoloop-theme') || (matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'));
themeToggle.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
