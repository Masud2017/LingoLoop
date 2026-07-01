const studyBot=document.getElementById('studyBot');
const studyBotFab=document.getElementById('studyBotFab');
const studyBotMessages=document.getElementById('studyBotMessages');
const studyBotInput=document.getElementById('studyBotInput');
const studyBotForm=document.getElementById('studyBotForm');
const studySessionBar=document.getElementById('studySessionBar');
const studyBotSubtitle=document.getElementById('studyBotSubtitle');
const STUDY_TRIAL_KEY='lingoloop-study-helper-trial';
const STUDY_PREMIUM_KEY='lingoloop-study-helper-premium';
let studySessions=[],activeStudySessionId='',studyFirebase=null,studyFirebaseUnsubscribe=null,remoteStudyLoaded=false;

import('./firebase-sync.js').then(module=>{studyFirebase=module;startStudyFirebaseSync()}).catch(()=>{studyFirebase=null});

function requireStudyLogin(){
  if(window.lingoUser)return true;
  const toast=document.getElementById('toast');
  if(toast){toast.textContent='Log in to use the Study Helper and start your 30-day trial.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}
  document.getElementById('authLogin')?.click();
  return false;
}
function studyTrialKey(){return `${STUDY_TRIAL_KEY}-${studyUserId()}`}
function studyPlan(){if(!window.lingoUser)return{premium:false,daysLeft:0,allowed:false,loginRequired:true};const premium=localStorage.getItem(STUDY_PREMIUM_KEY)==='active';let trial=Number(localStorage.getItem(studyTrialKey())||0);if(!trial){trial=Date.now();localStorage.setItem(studyTrialKey(),String(trial))}const daysLeft=Math.max(0,30-Math.floor((Date.now()-trial)/86400000));return{premium,daysLeft,allowed:premium||daysLeft>0,loginRequired:false}}
function studyUserId(){return window.lingoUser?.id||'guest'}
function studyStorageKey(){return`lingoloop-study-helper-sessions-${studyUserId()}`}
function defaultTitle(text='New study chat'){return String(text).trim().slice(0,36)||'New study chat'}
function newSession(seedMessage=''){return{id:crypto.randomUUID?.()||String(Date.now()),title:defaultTitle(seedMessage)||'New study chat',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}}
function saveStudySessions(){localStorage.setItem(studyStorageKey(),JSON.stringify(studySessions.slice(0,30)));const current=activeSession();if(current)studyFirebase?.saveStudySession?.(studyUserId(),current).catch(()=>{})}
function loadStudySessions(){try{studySessions=JSON.parse(localStorage.getItem(studyStorageKey())||'[]')}catch(_){studySessions=[]}if(!studySessions.length)studySessions=[newSession()];activeStudySessionId=localStorage.getItem(`${studyStorageKey()}-active`)||studySessions[0].id;if(!studySessions.some(session=>session.id===activeStudySessionId))activeStudySessionId=studySessions[0].id}
function activeSession(){return studySessions.find(session=>session.id===activeStudySessionId)||studySessions[0]}
function persistActiveSession(){localStorage.setItem(`${studyStorageKey()}-active`,activeStudySessionId)}
function startStudyFirebaseSync(){if(!studyFirebase?.ready?.())return;studyFirebaseUnsubscribe?.();studyFirebaseUnsubscribe=studyFirebase.listenStudySessions(studyUserId(),sessions=>{if(!sessions.length)return;remoteStudyLoaded=true;const map=new Map(studySessions.map(session=>[session.id,session]));sessions.forEach(session=>map.set(session.id,{...session,messages:session.messages||[]}));studySessions=[...map.values()].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,30);if(!studySessions.some(session=>session.id===activeStudySessionId))activeStudySessionId=studySessions[0].id;localStorage.setItem(studyStorageKey(),JSON.stringify(studySessions));renderStudySessions();renderStudyMessages()})}

function openStudyBot(){
  if(!requireStudyLogin())return;
  studyBot.classList.add('open');
  studyBot.classList.remove('minimized');
  studyBot.setAttribute('aria-hidden','false');
  if(!activeSession().messages.length)addStudyMessage('bot',`Hi! I am your Hugging Face powered study helper.\n\nTry asking:\n- Make me a 7 day Spanish plan\n- Explain German cases simply\n- Find resources for IELTS speaking\n- Give me 10 French practice questions`,[],{silent:false});
  setTimeout(()=>studyBotInput.focus(),80);
}
function closeStudyBot(){studyBot.classList.remove('open','maximized','minimized');studyBot.setAttribute('aria-hidden','true')}
function minimizeStudyBot(){studyBot.classList.add('minimized');studyBot.classList.remove('maximized')}
function maximizeStudyBot(){studyBot.classList.toggle('maximized');studyBot.classList.remove('minimized')}
function createStudyChat(seed=''){const session=newSession(seed);studySessions.unshift(session);activeStudySessionId=session.id;persistActiveSession();saveStudySessions();renderStudySessions();renderStudyMessages();studyBotInput.focus()}
function switchStudySession(id){activeStudySessionId=id;persistActiveSession();renderStudySessions();renderStudyMessages();studyBotInput.focus()}

function renderStudySessions(){
  if(!studySessionBar)return;
  studySessionBar.innerHTML='';
  studySessions.slice(0,8).forEach(session=>{
    const button=document.createElement('button');
    button.type='button';
    button.className=session.id===activeStudySessionId?'active':'';
    button.innerHTML='<span class="material-symbols-rounded">chat_bubble</span><b></b>';
    button.querySelector('b').textContent=session.title||'Study chat';
    button.addEventListener('click',()=>switchStudySession(session.id));
    studySessionBar.appendChild(button);
  });
  const plan=studyPlan();
  if(studyBotSubtitle)studyBotSubtitle.textContent=plan.loginRequired?'Log in to start your 30-day trial':plan.premium?'Premium study memory':`${plan.daysLeft} trial day${plan.daysLeft===1?'':'s'} left - Firebase memory`;
}

function renderStudyMessages(){
  studyBotMessages.innerHTML='';
  const session=activeSession();
  (session?.messages||[]).forEach(message=>renderStudyBubble(message.kind,message.text,message.links||[]));
  studyBotMessages.scrollTop=studyBotMessages.scrollHeight;
}

function renderStudyBubble(kind,text,links=[]){
  const bubble=document.createElement('div');
  bubble.className=`study-message ${kind}`;
  bubble.textContent=text;
  if(links.length){
    const resources=document.createElement('div');
    resources.className='study-resource-card';
    links.forEach(link=>{
      const anchor=document.createElement('a');
      anchor.href=link.href;
      anchor.target='_blank';
      anchor.rel='noopener';
      anchor.innerHTML=`<b>${link.label}</b><span class="material-symbols-rounded">open_in_new</span>`;
      resources.appendChild(anchor);
    });
    bubble.appendChild(resources);
  }
  studyBotMessages.appendChild(bubble);
  studyBotMessages.scrollTop=studyBotMessages.scrollHeight;
  return bubble;
}

function addStudyMessage(kind,text,links=[],options={}){
  const session=activeSession();
  if(!session)return renderStudyBubble(kind,text,links);
  const message={id:crypto.randomUUID?.()||String(Date.now()),kind,text,links,createdAt:Date.now()};
  session.messages=[...(session.messages||[]),message].slice(-80);
  if(kind==='user'&&(!session.title||session.title==='New study chat'))session.title=defaultTitle(text);
  session.updatedAt=Date.now();
  saveStudySessions();
  renderStudySessions();
  return options.silent?null:renderStudyBubble(kind,text,links);
}

function extractTopic(text){
  return String(text||'').toLowerCase().replace(/\b(make|me|a|an|the|find|resources|resource|for|about|explain|help|study|practice|questions|question|plan|internet|search|useful|recommend|recommendations|please)\b/g,' ').replace(/\s+/g,' ').trim() || 'language learning';
}
function resourceLinks(topic){
  const query=encodeURIComponent(topic);
  return [
    {label:'Search the web',href:`https://www.google.com/search?q=${query}`},
    {label:'YouTube lessons',href:`https://www.youtube.com/results?search_query=${query}+lesson`},
    {label:'Free courses/articles',href:`https://www.google.com/search?q=${query}+free+course+guide`},
    {label:'Practice exercises',href:`https://www.google.com/search?q=${query}+practice+exercises`}
  ];
}
function shouldShowResourceLinks(text){return /\b(resource|internet|search|website|youtube|recommend|link|information|info|course|article|lesson)\b/i.test(text)}
function localFallback(text){
  const topic=extractTopic(text),lower=text.toLowerCase();
  if(/\b(plan|schedule|routine|week|day)\b/.test(lower))return `Here is a focused 7-day study plan for ${topic}:\n\nDay 1: Learn the core basics and write 10 examples.\nDay 2: Watch or listen to one beginner lesson and shadow it aloud.\nDay 3: Practice vocabulary with spaced repetition for 20 minutes.\nDay 4: Speak or write using the topic for 10 minutes.\nDay 5: Review mistakes and identify the pattern.\nDay 6: Use it in a real task or conversation.\nDay 7: Test yourself and repeat the weak parts.`;
  if(/\b(question|practice|quiz|exercise|drill)\b/.test(lower))return `Practice set for ${topic}:\n\n1. Explain it in one simple sentence.\n2. Give 3 examples.\n3. Ask one question using it.\n4. Make one sentence in past, present, and future.\n5. Speak for 60 seconds without stopping.`;
  if(/\b(explain|what is|how|why|grammar|meaning)\b/.test(lower))return `Simple explanation mode for ${topic}:\n\n1. Start with the meaning.\n2. Learn the repeating pattern.\n3. Memorize one clear example.\n4. Make your own example.\n5. Compare it with a similar idea so you do not mix them up.`;
  return `I can help with ${topic}. Ask for a study plan, simple explanation, practice questions, or useful resources.`;
}
async function botReply(text){
  if(!requireStudyLogin())return;
  const plan=studyPlan();
  if(!plan.allowed){addStudyMessage('bot','Your 30-day free trial has ended. Subscribe to premium to keep using the study helper. Crypto payment can be enabled from the subscription section too.');return}
  const topic=extractTopic(text);
  const thinking=renderStudyBubble('bot','Thinking with Hugging Face...');
  try{
    const history=(activeSession().messages||[]).slice(-12).map(message=>({role:message.kind==='user'?'user':'assistant',content:message.text}));
    const response=await fetch('/api/study-bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history})});
    const result=await response.json();
    const links=shouldShowResourceLinks(text)?resourceLinks(topic):[];
    thinking.remove();
    const sourceLabel=result.source&&result.source!=='local'?`\n\nPowered by ${result.source}.`:'';
    addStudyMessage('bot',`${result.answer||localFallback(text)}${sourceLabel}${result.warning?`\n\nNote: ${result.warning}`:''}`,links);
  }catch(error){
    thinking.remove();
    addStudyMessage('bot',`${localFallback(text)}\n\nNote: Study Helper could not reach the AI server right now.`,shouldShowResourceLinks(text)?resourceLinks(topic):[]);
  }
}

studyBotFab?.addEventListener('click',openStudyBot);
document.getElementById('closeStudyBot')?.addEventListener('click',closeStudyBot);
document.getElementById('minimizeStudyBot')?.addEventListener('click',minimizeStudyBot);
document.getElementById('maximizeStudyBot')?.addEventListener('click',maximizeStudyBot);
document.getElementById('newStudyChat')?.addEventListener('click',()=>createStudyChat());
studyBot?.addEventListener('click',event=>{if(studyBot.classList.contains('minimized')&&!event.target.closest('.study-window-actions')){studyBot.classList.remove('minimized');studyBotInput.focus()}});
studyBotForm?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!requireStudyLogin())return;
  const text=studyBotInput.value.trim();
  if(!text)return;
  addStudyMessage('user',text);
  studyBotInput.value='';
  setTimeout(()=>botReply(text),180);
});
document.querySelectorAll('[data-study-prompt]').forEach(button=>button.addEventListener('click',()=>{
  if(!requireStudyLogin())return;
  openStudyBot();
  const text=button.dataset.studyPrompt;
  addStudyMessage('user',text);
  setTimeout(()=>botReply(text),160);
}));
window.addEventListener('lingo-auth-changed',()=>{studyFirebaseUnsubscribe?.();remoteStudyLoaded=false;loadStudySessions();renderStudySessions();renderStudyMessages();startStudyFirebaseSync()});
loadStudySessions();
renderStudySessions();
renderStudyMessages();
