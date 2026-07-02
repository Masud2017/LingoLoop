const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';
const root = __dirname;
const dataRoot = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
try { fs.mkdirSync(dataRoot, { recursive: true }); } catch (_) {}
const scoreFile = path.join(dataRoot,'community-scores.json');
const blockFile = path.join(dataRoot,'chat-blocks.json');
const identityFile = path.join(dataRoot,'user-identities.json');
const channelFile = path.join(dataRoot,'channels.json');
const requestFile = path.join(dataRoot,'friend-requests.json');
const notificationFile = path.join(dataRoot,'notification-tokens.json');
const ipBanFile = path.join(dataRoot,'ip-bans.json');
const shoutFile = path.join(dataRoot,'lingoshouts.json');
const blogFile = path.join(dataRoot,'blogs.json');
const payoutFile = path.join(dataRoot,'creator-payouts.json');
const rewardFile = path.join(dataRoot,'behavior-rewards.json');
const CHANNEL_TTL=3*24*60*60*1000;
loadEnvFile(path.join(root,'.env'));
const rooms = new Map();
const signals = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8' };
let userIdentities = new Map();
try { userIdentities = new Map(Object.entries(JSON.parse(fs.readFileSync(identityFile,'utf8')))); } catch (_) {}
let persistentChannels=new Map();
try{persistentChannels=new Map(Object.entries(JSON.parse(fs.readFileSync(channelFile,'utf8'))))}catch(_){}
let friendRequests=[];
try{friendRequests=JSON.parse(fs.readFileSync(requestFile,'utf8'))}catch(_){}
let notificationTokens=new Map();
try{notificationTokens=new Map(Object.entries(JSON.parse(fs.readFileSync(notificationFile,'utf8'))))}catch(_){}
let ipBans=new Map();
try{ipBans=new Map(Object.entries(JSON.parse(fs.readFileSync(ipBanFile,'utf8'))))}catch(_){}
let lingoshouts=[];
try{lingoshouts=JSON.parse(fs.readFileSync(shoutFile,'utf8'))}catch(_){}
let blogs=[];
try{blogs=JSON.parse(fs.readFileSync(blogFile,'utf8'))}catch(_){}
let creatorPayouts=new Map();
try{creatorPayouts=new Map(Object.entries(JSON.parse(fs.readFileSync(payoutFile,'utf8'))))}catch(_){}
let behaviorRewards=new Map();
try{behaviorRewards=new Map(Object.entries(JSON.parse(fs.readFileSync(rewardFile,'utf8'))))}catch(_){}

const normalizeHandle = value => String(value || '').trim().toLowerCase();
const publicUser = user => ({ uid:user.uid, name:user.name, handle:user.handle, avatar:user.avatar || '' });
function saveIdentities(){fs.writeFileSync(identityFile,JSON.stringify(Object.fromEntries(userIdentities),null,2))}
function saveChannels(){fs.writeFileSync(channelFile,JSON.stringify(Object.fromEntries(persistentChannels),null,2))}
function saveFriendRequests(){fs.writeFileSync(requestFile,JSON.stringify(friendRequests,null,2))}
function saveNotificationTokens(){fs.writeFileSync(notificationFile,JSON.stringify(Object.fromEntries(notificationTokens),null,2))}
function saveIpBans(){fs.writeFileSync(ipBanFile,JSON.stringify(Object.fromEntries(ipBans),null,2))}
function saveLingoshouts(){fs.writeFileSync(shoutFile,JSON.stringify(lingoshouts,null,2))}
function saveBlogs(){fs.writeFileSync(blogFile,JSON.stringify(blogs,null,2))}
function saveCreatorPayouts(){fs.writeFileSync(payoutFile,JSON.stringify(Object.fromEntries(creatorPayouts),null,2))}
function saveBehaviorRewards(){fs.writeFileSync(rewardFile,JSON.stringify(Object.fromEntries(behaviorRewards),null,2))}
function removeExpiredChannels(){const now=Date.now();let changed=false;for(const [id,channel] of persistentChannels){if(Number(channel.expiresAt||0)<=now){persistentChannels.delete(id);rooms.delete(id);changed=true}}if(changed)saveChannels()}
function touchChannel(id){const channel=persistentChannels.get(String(id));if(!channel)return;channel.lastActivityAt=Date.now();channel.expiresAt=channel.lastActivityAt+CHANNEL_TTL;persistentChannels.set(String(id),channel);saveChannels()}
function roomState(room,clientId,limit){
  let state=rooms.get(room);
  if(!state){
    state={members:new Set(),banned:new Set(),bannedIpHashes:new Set(),clientIps:new Map(),clientIpHashes:new Map(),profiles:new Map(),hostId:clientId,limit:Math.max(2,Math.min(100,Number(limit)||12))};
    rooms.set(room,state);
  }
  if(!state.bannedIpHashes)state.bannedIpHashes=new Set();
  if(!state.clientIps)state.clientIps=new Map();
  if(!state.clientIpHashes)state.clientIpHashes=new Map();
  return state;
}
function rememberClientIp(state,clientId,req){
  const ip=requestIp(req);
  if(isBanEligibleIp(ip)){state.clientIps.set(clientId,ip);state.clientIpHashes.set(clientId,ipHash(ip))}
  return ip;
}
function isRoomIpBanned(state,ip){return isBanEligibleIp(ip)&&state?.bannedIpHashes?.has(ipHash(ip))}
function cleanHandle(value) {
  let handle=String(value||'').trim();
  if(!handle.startsWith('@'))handle=`@${handle}`;
  if(!/^@[a-zA-Z0-9_.]{3,30}$/.test(handle))return null;
  return `@${handle.slice(1).toLowerCase()}`;
}
function handleTaken(handle,exceptUid=''){
  const wanted=normalizeHandle(handle);
  return [...userIdentities.values()].some(user=>user.uid!==exceptUid&&normalizeHandle(user.handle)===wanted);
}
function generatedHandle(firstName,uid){
  let base=String(firstName||'learner').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g,'')||'learner';
  base=base.slice(0,24);
  for(let attempt=0;attempt<100;attempt++){
    const number=String(Math.floor(Math.random()*100)).padStart(2,'0');
    const candidate=`@${base}_${number}`;
    if(!handleTaken(candidate,uid))return candidate;
  }
  base=`${base}${String(uid).replace(/[^a-z0-9]/gi,'').slice(-4).toLowerCase()}`.slice(0,27);
  for(let number=0;number<100;number++){const candidate=`@${base}_${String(number).padStart(2,'0')}`;if(!handleTaken(candidate,uid))return candidate}
  throw new Error('Could not generate a unique ID');
}

function loadEnvFile(file){
  try{
    const content=fs.readFileSync(file,'utf8');
    content.split(/\r?\n/).forEach(line=>{
      const trimmed=line.trim();
      if(!trimmed||trimmed.startsWith('#')||!trimmed.includes('='))return;
      const index=trimmed.indexOf('='),key=trimmed.slice(0,index).trim(),value=trimmed.slice(index+1).trim().replace(/^["']|["']$/g,'');
      if(key&&!process.env[key])process.env[key]=value;
    });
  }catch(_){}
}

function studyFallback(question){
  const topic=String(question||'language learning').toLowerCase().replace(/\b(make|me|a|an|the|find|resources|resource|for|about|explain|help|study|practice|questions|question|plan|internet|search|useful|recommend|recommendations|please)\b/g,' ').replace(/\s+/g,' ').trim()||'language learning';
  if(/\b(plan|schedule|routine|week|day)\b/i.test(question))return `Here is a practical study plan for ${topic}:\n\n1. Learn one small concept.\n2. Write 10 examples.\n3. Listen to native examples for 10 minutes.\n4. Speak out loud for 5 minutes.\n5. Review mistakes and repeat tomorrow.\n\nFor stronger results, study in 25-minute blocks and practice speaking inside a LingoLoop room.`;
  if(/\b(resource|internet|search|website|youtube|recommend|link|information|info)\b/i.test(question))return `I can help you find resources for ${topic}. Open the links below for current internet results, then bring anything confusing back here and I can help you study it.`;
  if(/\b(question|practice|quiz|exercise|drill)\b/i.test(question))return `Practice questions for ${topic}:\n\n1. Explain it in one sentence.\n2. Give three examples.\n3. Make one beginner sentence and one advanced sentence.\n4. Correct your own mistake.\n5. Use it in a short conversation.`;
  return `I can help with ${topic}. Ask me for a plan, explanation, practice questions, or useful resources.`;
}

function studyPrompt(question){
  return `You are LingoLoop Study Helper, a friendly ChatGPT-like tutor inside a language practice app.
Help the learner study clearly and practically. Give concise answers, useful examples, practice tasks, and safe resource suggestions.
If the user asks for current internet information, explain that you can recommend what to search for, but you do not browse live pages yourself.

User question: ${String(question||'').slice(0,1500)}

Helpful answer:`;
}

async function askHuggingFace(question){
  const token=process.env.HUGGINGFACE_API_KEY||process.env.HF_TOKEN||process.env.HUGGINGFACE_TOKEN;
  if(!token)return {answer:studyFallback(question),source:'local',warning:'Add HUGGINGFACE_API_KEY to .env to enable Hugging Face AI replies.'};
  const model=process.env.HUGGINGFACE_MODEL||'meta-llama/Meta-Llama-3-8B-Instruct';
  const routerAnswer=await askHuggingFaceRouter(question,token,model).catch(error=>({error}));
  if(!routerAnswer.error)return routerAnswer;
  const legacyModel=(process.env.HUGGINGFACE_LEGACY_MODEL||'HuggingFaceH4/zephyr-7b-beta').replace(/:.+$/,'');
  const legacyAnswer=await askHuggingFaceLegacy(question,token,legacyModel).catch(error=>({error}));
  if(!legacyAnswer.error)return {...legacyAnswer,warning:`Router failed: ${routerAnswer.error.message}`};
  throw new Error(`Hugging Face unavailable. Router: ${routerAnswer.error.message}; legacy: ${legacyAnswer.error.message}`);
}

async function askHuggingFaceRouter(question,token,model){
  const response=await fetch('https://router.huggingface.co/v1/chat/completions',{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,
      messages:[
        {role:'system',content:'You are LingoLoop Study Helper, a friendly ChatGPT-like tutor inside a language practice app. Give concise answers, useful examples, practice tasks, and safe resource suggestions.'},
        {role:'user',content:String(question||'').slice(0,1500)}
      ],
      max_tokens:420,
      temperature:0.65
    })
  });
  const text=await response.text();
  if(!response.ok)throw new Error(`router ${response.status}: ${text.slice(0,180)}`);
  let data;try{data=JSON.parse(text)}catch(_){data=text}
  const answer=String(data?.choices?.[0]?.message?.content||data?.choices?.[0]?.text||'').trim();
  return {answer:answer||studyFallback(question),source:'huggingface-router',model};
}

async function askHuggingFaceLegacy(question,token,model){
  const modelPath=model.split('/').map(encodeURIComponent).join('/');
  const response=await fetch(`https://api-inference.huggingface.co/models/${modelPath}`,{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({inputs:studyPrompt(question),parameters:{max_new_tokens:420,temperature:0.65,return_full_text:false},options:{wait_for_model:true}})
  });
  const text=await response.text();
  if(!response.ok)throw new Error(`Hugging Face error ${response.status}: ${text.slice(0,180)}`);
  let data;try{data=JSON.parse(text)}catch(_){data=text}
  const generated=Array.isArray(data)?data[0]?.generated_text:data.generated_text||data[0]?.summary_text||data;
  const answer=String(generated||'').trim();
  return {answer:answer||studyFallback(question),source:'huggingface-legacy',model};
}

function decodeXmlEntities(value=''){
  return String(value)
    .replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>');
}
function stripXml(value=''){return decodeXmlEntities(String(value).replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim()}
function newsParagraphs(raw='',fallback=''){
  const decoded=decodeXmlEntities(String(raw||fallback||'').replace(/<!\[CDATA\[|\]\]>/g,''));
  const htmlParagraphs=[...decoded.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(match=>stripXml(match[1])).filter(Boolean);
  const plain=stripXml(decoded);
  const chunks=(htmlParagraphs.length?htmlParagraphs:plain.split(/(?<=[.!?])\s+/)).map(item=>item.trim()).filter(Boolean);
  return chunks.slice(0,2);
}
function cleanNewsImageUrl(value=''){
  const url=decodeXmlEntities(String(value||'').trim());
  if(!/^https?:\/\//i.test(url))return '';
  return url.slice(0,1000);
}
function extractNewsImage(item='',content='',description=''){
  const candidates=[
    (item.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i)||[])[1],
    (item.match(/<media:content\b[^>]*\burl=["']([^"']+)["'][^>]*\bmedium=["']image["']/i)||[])[1],
    (item.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i)||[])[1],
    (item.match(/<enclosure\b[^>]*\btype=["']image\/[^"']+["'][^>]*\burl=["']([^"']+)["']/i)||[])[1],
    (item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["']/i)||[])[1],
    (String(content||description||'').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)||[])[1]
  ];
  return candidates.map(cleanNewsImageUrl).find(Boolean)||'';
}
function trustedNewsFallback(){
  const bbc=[
    ['Open BBC latest news','https://www.bbc.com/news'],
    ['Open BBC world news','https://www.bbc.com/news/world'],
    ['Open BBC politics','https://www.bbc.com/news/politics'],
    ['Open BBC business','https://www.bbc.com/news/business'],
    ['Open BBC technology','https://www.bbc.com/news/technology']
  ];
  const aljazeera=[
    ['Open Al Jazeera latest news','https://www.aljazeera.com/news/'],
    ['Open Al Jazeera world news','https://www.aljazeera.com/news/'],
    ['Open Al Jazeera politics','https://www.aljazeera.com/tag/politics/'],
    ['Open Al Jazeera economy','https://www.aljazeera.com/economy/'],
    ['Open Al Jazeera science and technology','https://www.aljazeera.com/tag/science-and-technology/']
  ];
  return [
    ...bbc.map(([title,link])=>({source:'BBC',title,link,paragraphs:['Live RSS could not be reached from this local environment. Open this trusted BBC section for the latest headlines.']})),
    ...aljazeera.map(([title,link])=>({source:'Al Jazeera',title,link,paragraphs:['Live RSS could not be reached from this local environment. Open this trusted Al Jazeera section for the latest headlines.']}))
  ];
}
async function fetchTrustedNews(){
  const feeds=[
    {source:'BBC',url:'https://feeds.bbci.co.uk/news/rss.xml'},
    {source:'Al Jazeera',url:'https://www.aljazeera.com/xml/rss/all.xml'}
  ];
  const results=[];
  for(const feed of feeds){
    try{
      const response=await fetch(feed.url,{headers:{'User-Agent':'LingoLoop/1.0'}});
      if(!response.ok)throw new Error(`${feed.source} ${response.status}`);
      const xml=await response.text();
      [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,5).forEach(match=>{
        const item=match[1],title=stripXml((item.match(/<title>([\s\S]*?)<\/title>/)||[])[1]),link=stripXml((item.match(/<link>([\s\S]*?)<\/link>/)||[])[1]),pubDate=stripXml((item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1]),description=(item.match(/<description>([\s\S]*?)<\/description>/)||[])[1],content=(item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)||[])[1],image=extractNewsImage(item,content,description);
        if(title&&link)results.push({source:feed.source,title,link,pubDate,image,paragraphs:newsParagraphs(content,description)});
      });
    }catch(error){console.warn('Trusted news feed failed:',feed.source,error.message)}
  }
  if(results.length)return results;
  return trustedNewsFallback();
}

function requestIp(req){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(item=>item.trim()).filter(Boolean)[0];
  return canonicalIp(forwarded||req.socket.remoteAddress||'');
}
function canonicalIp(ip){
  return String(ip||'').trim().replace(/^::ffff:/,'').replace(/^0:0:0:0:0:ffff:/,'');
}
function isPrivateIp(ip){
  return !ip||ip==='::1'||ip==='127.0.0.1'||ip.startsWith('10.')||ip.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(ip)||ip.startsWith('fc')||ip.startsWith('fd');
}
function ipHash(ip){return crypto.createHash('sha256').update(canonicalIp(ip)).digest('hex')}
function maskedIp(ip){
  ip=canonicalIp(ip);
  if(!ip)return '';
  if(ip.includes(':'))return `${ip.split(':').slice(0,3).join(':')}:...`;
  const parts=ip.split('.');
  return parts.length===4?`${parts[0]}.${parts[1]}.${parts[2]}.0/24`:ip;
}
function isBanEligibleIp(ip){return !!ip&&!isPrivateIp(ip)}
function isIpBanned(ip){return isBanEligibleIp(ip)&&ipBans.has(ipHash(ip))}
function addIpBan(ip,details={}){
  if(!isBanEligibleIp(ip))return false;
  ipBans.set(ipHash(ip),{...details,maskedIp:maskedIp(ip),createdAt:Date.now()});
  saveIpBans();
  return true;
}
async function getSessionMetadata(req){
  const ip=requestIp(req);
  const metadata={ip,ipType:isPrivateIp(ip)?'private_or_local':'public',country:'Unknown',countryCode:'',region:'',city:'',area:'',timezone:'',source:'server'};
  if(isPrivateIp(ip)){metadata.area='Local/private network';return metadata}
  try{
    const response=await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`,{headers:{'User-Agent':'LingoLoop/1.0'}});
    if(!response.ok)throw new Error(`geo lookup failed ${response.status}`);
    const geo=await response.json();
    metadata.country=geo.country_name||'Unknown';
    metadata.countryCode=geo.country||'';
    metadata.region=geo.region||'';
    metadata.city=geo.city||'';
    metadata.area=[geo.city,geo.region,geo.country_name].filter(Boolean).join(', ');
    metadata.timezone=geo.timezone||'';
    metadata.source='ipapi.co';
  }catch(error){metadata.lookupError=error.message}
  return metadata;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*' });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (error) { reject(error); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if(isIpBanned(requestIp(req))){
      return json(res,403,{error:'Access is blocked for this network'});
    }
    if(req.method==='POST'&&url.pathname==='/api/users/register'){
      const {uid,name,firstName,avatar}=await body(req);
      if(!uid)return json(res,400,{error:'Missing user ID'});
      const safeUid=String(uid).slice(0,128),existing=userIdentities.get(safeUid);
      const user=existing||{uid:safeUid,handle:generatedHandle(firstName||name,safeUid)};
      user.name=String(name||firstName||user.name||'Learner').slice(0,60);
      user.avatar=String(avatar||user.avatar||'').slice(0,1000);
      userIdentities.set(safeUid,user);saveIdentities();
      return json(res,200,publicUser(user));
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/users/')&&url.pathname.endsWith('/handle')){
      const uid=decodeURIComponent(url.pathname.slice('/api/users/'.length,-'/handle'.length));
      const user=userIdentities.get(uid);if(!user)return json(res,404,{error:'User not found'});
      const request=await body(req),handle=cleanHandle(request.handle);
      if(!handle)return json(res,400,{error:'Use 3-30 letters, numbers, underscores, or dots'});
      if(handleTaken(handle,uid))return json(res,409,{error:'That ID is already taken'});
      user.handle=handle;userIdentities.set(uid,user);saveIdentities();return json(res,200,publicUser(user));
    }
    if(req.method==='GET'&&url.pathname==='/api/users/search'){
      const query=normalizeHandle(url.searchParams.get('q'));
      if(!query.startsWith('@')||query.length<2)return json(res,200,{users:[]});
      const users=[...userIdentities.values()].filter(user=>normalizeHandle(user.handle).startsWith(query)).sort((a,b)=>normalizeHandle(a.handle)===query?-1:normalizeHandle(b.handle)===query?1:a.handle.localeCompare(b.handle)).slice(0,8).map(publicUser);
      return json(res,200,{users});
    }
    if(req.method==='GET'&&url.pathname==='/api/friend-requests'){
      const uid=String(url.searchParams.get('uid')||'').slice(0,128);
      if(!uid)return json(res,400,{error:'Missing user ID'});
      const decorate=request=>({...request,fromUser:publicUser(userIdentities.get(request.from)||{uid:request.from,name:'Learner',handle:'@learner'}),toUser:publicUser(userIdentities.get(request.to)||{uid:request.to,name:'Learner',handle:'@learner'})});
      return json(res,200,{incoming:friendRequests.filter(item=>item.to===uid&&item.status==='pending').map(decorate),outgoing:friendRequests.filter(item=>item.from===uid&&item.status==='pending').map(decorate),accepted:friendRequests.filter(item=>item.status==='accepted'&&(item.from===uid||item.to===uid)).map(decorate)});
    }
    if(req.method==='POST'&&url.pathname==='/api/friend-requests'){
      const request=await body(req),from=String(request.from||'').slice(0,128),to=String(request.to||'').slice(0,128);
      if(!from||!to||from===to)return json(res,400,{error:'Invalid friend request'});
      if(!userIdentities.has(from)||!userIdentities.has(to))return json(res,404,{error:'User not found'});
      const existing=friendRequests.find(item=>((item.from===from&&item.to===to)||(item.from===to&&item.to===from))&&item.status!=='declined');
      if(existing)return json(res,200,{request:existing});
      const friendRequest={id:`fr-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,from,to,status:'pending',createdAt:Date.now(),updatedAt:Date.now()};
      friendRequests.push(friendRequest);saveFriendRequests();
      const fromUser=userIdentities.get(from);
      sendLiveNotification(to,{title:'New friend request',body:`${fromUser?.name||'Someone'} wants to connect with you.`,notificationKind:'friend-request',requestId:friendRequest.id,from});
      return json(res,201,{request:friendRequest});
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/friend-requests/')){
      const id=decodeURIComponent(url.pathname.slice('/api/friend-requests/'.length)),request=await body(req),actor=String(request.actor||'').slice(0,128),action=String(request.action||'');
      const friendRequest=friendRequests.find(item=>item.id===id);
      if(!friendRequest)return json(res,404,{error:'Request not found'});
      if(![friendRequest.from,friendRequest.to].includes(actor))return json(res,403,{error:'Not allowed'});
      if(action==='accept'&&actor!==friendRequest.to)return json(res,403,{error:'Only recipient can approve'});
      if(action==='accept')friendRequest.status='accepted';
      else if(action==='cancel'||action==='decline')friendRequest.status='declined';
      else return json(res,400,{error:'Unknown action'});
      friendRequest.updatedAt=Date.now();saveFriendRequests();
      if(action==='accept'){
        const actorUser=userIdentities.get(actor);
        const other=friendRequest.from===actor?friendRequest.to:friendRequest.from;
        sendLiveNotification(other,{title:'Friend request accepted',body:`${actorUser?.name||'Your friend'} accepted your request.`,notificationKind:'friend-accepted',requestId:friendRequest.id,from:actor});
      }
      return json(res,200,{request:friendRequest});
    }
    if(req.method==='POST'&&url.pathname==='/api/notification-token'){
      const request=await body(req),uid=String(request.uid||'').slice(0,128),token=String(request.token||'').slice(0,4000);
      if(!uid||!token)return json(res,400,{error:'Missing notification token'});
      notificationTokens.set(uid,{token,updatedAt:Date.now()});saveNotificationTokens();return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&url.pathname==='/api/study-bot'){
      const request=await body(req),message=String(request.message||'').slice(0,1500);
      if(!message.trim())return json(res,400,{error:'Ask a study question first'});
      try{return json(res,200,await askHuggingFace(message))}
      catch(error){return json(res,200,{answer:studyFallback(message),source:'local',warning:error.message})}
    }
    if(req.method==='GET'&&url.pathname==='/api/news'){
      return json(res,200,{items:await fetchTrustedNews(),sources:['BBC','Al Jazeera']});
    }
    if(req.method==='GET'&&url.pathname==='/api/lingoshouts'){
      return json(res,200,{items:lingoshouts.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,50)});
    }
    if(req.method==='POST'&&url.pathname==='/api/lingoshouts'){
      const request=await body(req),uid=String(request.uid||'').slice(0,128),text=String(request.text||'').trim().slice(0,280);
      if(!uid||!text)return json(res,400,{error:'Missing shout'});
      const user=userIdentities.get(uid)||{uid,name:request.name||'Learner',handle:''};
      const shout={id:`ls-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,uid,text,author:publicUser(user),likes:[],comments:[],createdAt:Date.now()};
      lingoshouts.unshift(shout);lingoshouts=lingoshouts.slice(0,200);saveLingoshouts();return json(res,201,{item:shout});
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/lingoshouts/')){
      const id=decodeURIComponent(url.pathname.slice('/api/lingoshouts/'.length)),request=await body(req),uid=String(request.uid||'').slice(0,128),action=String(request.action||''),shout=lingoshouts.find(item=>item.id===id);
      if(!shout||!uid)return json(res,404,{error:'Shout not found'});
      if(action==='like'){shout.likes=[...new Set([...(shout.likes||[]),uid])]}
      else if(action==='unlike'){shout.likes=(shout.likes||[]).filter(item=>item!==uid)}
      else if(action==='comment'){const text=String(request.text||'').trim().slice(0,220);if(text)shout.comments.push({id:`c-${Date.now()}`,uid,text,author:publicUser(userIdentities.get(uid)||{uid,name:'Learner',handle:''}),createdAt:Date.now()})}
      else return json(res,400,{error:'Unknown action'});
      saveLingoshouts();return json(res,200,{item:shout});
    }
    if(req.method==='GET'&&url.pathname==='/api/blogs')return json(res,200,{items:blogs.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,50)});
    if(req.method==='POST'&&url.pathname==='/api/blogs'){
      const request=await body(req),uid=String(request.uid||'').slice(0,128),title=String(request.title||'').trim().slice(0,90),content=String(request.content||'').trim().slice(0,4000);
      if(!uid||!title||!content)return json(res,400,{error:'Missing blog content'});
      const user=userIdentities.get(uid)||{uid,name:request.name||'Learner',handle:''};
      const item={id:`blog-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,uid,title,content,author:publicUser(user),likes:[],comments:[],blogAdRevenueCents:0,creatorSharePercent:80,createdAt:Date.now()};
      blogs.unshift(item);blogs=blogs.slice(0,200);saveBlogs();return json(res,201,{item});
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/blogs/')){
      const id=decodeURIComponent(url.pathname.slice('/api/blogs/'.length)),request=await body(req),uid=String(request.uid||'').slice(0,128),action=String(request.action||''),blog=blogs.find(item=>item.id===id);
      if(!blog||!uid)return json(res,404,{error:'Blog not found'});
      if(action==='like')blog.likes=[...new Set([...(blog.likes||[]),uid])];else if(action==='unlike')blog.likes=(blog.likes||[]).filter(item=>item!==uid);else if(action==='comment'){const text=String(request.text||'').trim().slice(0,300);if(text)blog.comments.push({id:`bc-${Date.now()}`,uid,text,author:publicUser(userIdentities.get(uid)||{uid,name:'Learner',handle:''}),createdAt:Date.now()})}else return json(res,400,{error:'Unknown action'});
      saveBlogs();return json(res,200,{item:blog});
    }
    if(req.method==='POST'&&url.pathname==='/api/payout-info'){
      const request=await body(req),uid=String(request.uid||'').slice(0,128),iban=String(request.iban||'').trim().slice(0,60),country=String(request.country||'').trim().slice(0,60),legalName=String(request.legalName||'').trim().slice(0,100);
      if(!uid||!iban||!country||!legalName)return json(res,400,{error:'IBAN, country, and legal name are required'});
      creatorPayouts.set(uid,{iban,country,legalName,region:'Europe only',updatedAt:Date.now()});saveCreatorPayouts();return json(res,200,{ok:true});
    }
    if(req.method==='GET'&&url.pathname==='/api/session-metadata'){
      const metadata=await getSessionMetadata(req);
      return json(res,200,{...metadata,capturedAt:Date.now()});
    }
    if(req.method==='GET'&&url.pathname.startsWith('/api/profiles/')){
      removeExpiredChannels();const uid=decodeURIComponent(url.pathname.slice('/api/profiles/'.length)),user=userIdentities.get(uid);
      if(!user)return json(res,404,{error:'Profile not found'});
      const channels=[...persistentChannels.values()].filter(channel=>channel.creatorId===uid).sort((a,b)=>b.createdAt-a.createdAt);
      return json(res,200,{user:publicUser(user),behaviorPoints:getCommunityScore(uid),channelCount:channels.length,channels});
    }
    if(req.method==='GET'&&url.pathname==='/api/channels'){
      removeExpiredChannels();return json(res,200,{channels:[...persistentChannels.values()].sort((a,b)=>b.lastActivityAt-a.lastActivityAt)});
    }
    if(req.method==='POST'&&url.pathname==='/api/channels'){
      const request=await body(req);if(!request.id||!request.creatorId||!userIdentities.has(String(request.creatorId)))return json(res,400,{error:'A signed-in creator is required'});
      const now=Date.now(),channel={id:String(request.id).slice(0,128),name:String(request.name||'Conversation').slice(0,80),language:String(request.language||'English').slice(0,30),level:String(request.level||'All levels').slice(0,40),memberLimit:Math.max(2,Math.min(100,Number(request.memberLimit)||12)),creatorId:String(request.creatorId).slice(0,128),creatorName:String(request.creatorName||'Creator').slice(0,60),creatorHandle:String(request.creatorHandle||'').slice(0,32),creatorAvatar:String(request.creatorAvatar||'').slice(0,1000),createdAt:Number(request.createdAt)||now,lastActivityAt:now,expiresAt:now+CHANNEL_TTL};
      persistentChannels.set(channel.id,channel);saveChannels();return json(res,201,{channel});
    }
    if(req.method==='PATCH'&&url.pathname.startsWith('/api/channels/')){
      const id=decodeURIComponent(url.pathname.slice('/api/channels/'.length)),channel=persistentChannels.get(id),request=await body(req);if(!channel)return json(res,404,{error:'Channel not found'});if(channel.creatorId!==request.creatorId)return json(res,403,{error:'Only the creator can update this channel'});
      channel.name=String(request.name||channel.name).slice(0,80);channel.language=String(request.language||channel.language).slice(0,30);channel.level=String(request.level||channel.level||'All levels').slice(0,40);channel.memberLimit=Math.max(2,Math.min(100,Number(request.memberLimit)||channel.memberLimit));touchChannel(id);return json(res,200,{channel});
    }
    if(req.method==='DELETE'&&url.pathname.startsWith('/api/channels/')){
      const id=decodeURIComponent(url.pathname.slice('/api/channels/'.length)),channel=persistentChannels.get(id),request=await body(req);if(!channel)return json(res,404,{error:'Channel not found'});if(channel.creatorId!==request.creatorId)return json(res,403,{error:'Only the creator can delete this channel'});persistentChannels.delete(id);rooms.delete(id);saveChannels();broadcastSocketEvent({type:'channel-deleted',id,name:channel.name});return json(res,200,{ok:true});
    }
    if (req.method === 'POST' && url.pathname === '/api/reserve') {
      const { clientId, room, limit, user } = await body(req);
      if (!clientId || !room) return json(res,400,{error:'Missing client or room'});
      const state=roomState(room,clientId,limit);
      const ip=rememberClientIp(state,clientId,req);
      if(isRoomIpBanned(state,ip))return json(res,403,{error:'You were banned from this group'});
      if(state.banned.has(clientId))return json(res,403,{error:'You were banned from this group'});
      if(!state.members.has(clientId)&&state.members.size>=state.limit)return json(res,409,{error:'Group is full'});
      rememberRoomProfile(state,clientId,user);
      state.members.add(clientId);signals.set(clientId,signals.get(clientId)||[]);
      touchChannel(room);
      return json(res,200,{ok:true,hostId:state.hostId,limit:state.limit,memberCount:state.members.size});
    }
    if (req.method === 'POST' && url.pathname === '/api/join') {
      const { clientId, room, limit, user } = await body(req);
      if (!clientId || !room) return json(res, 400, { error:'Missing client or room' });
      const state=roomState(room,clientId,limit);
      const ip=rememberClientIp(state,clientId,req);
      if (isRoomIpBanned(state,ip)) return json(res, 403, { error:'You were banned from this channel' });
      if (state.banned.has(clientId)) return json(res, 403, { error:'You were banned from this channel' });
      if (!state.members.has(clientId) && state.members.size >= state.limit) return json(res, 409, { error:`This channel is full (${state.limit} members)` });
      const peers = [...state.members].filter(id => id !== clientId);
      rememberRoomProfile(state,clientId,user);
      state.members.add(clientId); signals.set(clientId, signals.get(clientId) || []);
      touchChannel(room);
      return json(res, 200, { peers, peerProfiles:Object.fromEntries(peers.map(peer=>[peer,profileForClient(state,peer)])), hostId:state.hostId, hostProfile:profileForClient(state,state.hostId), limit:state.limit, memberCount:state.members.size });
    }
    if (req.method === 'POST' && url.pathname === '/api/signal') {
      const message = await body(req);
      const queue = signals.get(message.to) || [];
      queue.push(message); signals.set(message.to, queue);
      return json(res, 200, { ok:true });
    }
    if (req.method === 'GET' && url.pathname === '/api/signals') {
      const clientId = url.searchParams.get('client');
      const queue = signals.get(clientId) || [];
      signals.set(clientId, []);
      return json(res, 200, { messages:queue });
    }
    if (req.method === 'POST' && url.pathname === '/api/leave') {
      const { clientId, room } = await body(req);
      const state=rooms.get(room); state?.members.delete(clientId); state?.profiles?.delete(clientId); state?.clientIps?.delete(clientId); state?.clientIpHashes?.delete(clientId); signals.delete(clientId);
      if(state && !state.members.size) rooms.delete(room);
      return json(res, 200, { ok:true });
    }
    if (req.method === 'POST' && url.pathname === '/api/moderate') {
      const { room, actorId, targetId, action } = await body(req);
      const state=rooms.get(room);
      if(!state || state.hostId!==actorId) return json(res,403,{error:'Only the channel creator can moderate'});
      if(!['mute','remove','ban'].includes(action)||targetId===actorId) return json(res,400,{error:'Invalid moderation action'});
      const queue=signals.get(targetId)||[]; queue.push({from:actorId,type:'moderation',payload:{action,room}}); signals.set(targetId,queue);
      if(action==='remove'||action==='ban') state.members.delete(targetId);
      if(action==='ban'){
        state.banned.add(targetId);
        const targetIpHash=state.clientIpHashes?.get(targetId);
        if(targetIpHash)state.bannedIpHashes.add(targetIpHash);
        const targetIp=state.clientIps?.get(targetId);
        const globalIpBanAdded=addIpBan(targetIp,{reason:'room-ban',room,actorId,targetId});
        if(globalIpBanAdded)disconnectIpHash(ipHash(targetIp));
        return json(res,200,{ok:true,action,ipBanAdded:!!targetIpHash,globalIpBanAdded});
      }
      return json(res,200,{ok:true,action});
    }

    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(root, requested);
    if (path.basename(file).startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    json(res, 500, { error:error.message });
  }
});

const chatClients = new Map();
const offlineMessages = new Map();
const channelSockets = new Map();
let chatBlocks=new Map();
try{chatBlocks=new Map(Object.entries(JSON.parse(fs.readFileSync(blockFile,'utf8'))).map(([id,list])=>[id,new Set(list)]))}catch(_){}
function saveChatBlocks(){try{fs.writeFileSync(blockFile,JSON.stringify(Object.fromEntries([...chatBlocks].map(([id,set])=>[id,[...set]])),null,2))}catch(_){}}
const chatDiscipline = new Map();
let communityScores = new Map();
try { communityScores=new Map(Object.entries(JSON.parse(fs.readFileSync(scoreFile,'utf8')))); } catch (_) {}
function rewardCleanDay(userId){
  if(!userId)return;
  const today=new Date().toISOString().slice(0,10),last=behaviorRewards.get(userId);
  if(last===today)return;
  const next=Math.min(10000,Number(communityScores.get(userId)??5000)+300);
  communityScores.set(userId,next);behaviorRewards.set(userId,today);saveCommunityScores();saveBehaviorRewards();
}
function getCommunityScore(userId){rewardCleanDay(userId);return Number(communityScores.get(userId)??5000)}
function saveCommunityScores(){try{fs.writeFileSync(scoreFile,JSON.stringify(Object.fromEntries(communityScores),null,2))}catch(_){}}
function deductCommunityPoints(userId){const points=Math.max(0,getCommunityScore(userId)-200);communityScores.set(userId,points);saveCommunityScores();return points}
function acceptedFriendIds(uid){return friendRequests.filter(item=>item.status==='accepted'&&(item.from===uid||item.to===uid)).map(item=>item.from===uid?item.to:item.from)}
function sendLiveNotification(uid,payload){const client=chatClients.get(uid);if(client?.readyState===WebSocket.OPEN)client.send(JSON.stringify({type:'app-notification',...payload}))}
function broadcastSocketEvent(payload){try{wss?.clients?.forEach(client=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(payload))})}catch(_){}}
function disconnectIpHash(hash){
  if(!hash||!wss?.clients)return;
  wss.clients.forEach(client=>{
    if(client.remoteIpHash===hash&&client.readyState===WebSocket.OPEN){
      client.send(JSON.stringify({type:'access-blocked',message:'Access is blocked for this network'}));
      client.close(1008,'Network banned');
    }
  });
}
const blockedTerms = ['fuck','shit','bitch','asshole','bastard','damn'];
function filterProfanity(text) {
  let clean=String(text||'').slice(0,2000), detected=false;
  blockedTerms.forEach(term=>{const pattern=new RegExp(`\\b${term}\\b`,'gi');if(pattern.test(clean)){detected=true;clean=clean.replace(pattern,'****')}});
  return {clean,detected};
}
function moderateChat(userId,text) {
  const now=Date.now(); let state=chatDiscipline.get(userId)||{strikes:0,suspendedUntil:0};
  const currentPoints=getCommunityScore(userId);
  if(currentPoints<2000)return {blocked:true,scoreBlocked:true,strikes:state.strikes,suspendedUntil:0,points:currentPoints,clean:'',detected:false};
  if(state.suspendedUntil&&state.suspendedUntil<=now) state={strikes:0,suspendedUntil:0};
  if(state.suspendedUntil>now) return {blocked:true,strikes:3,suspendedUntil:state.suspendedUntil,points:currentPoints,clean:'',detected:false};
  const filtered=filterProfanity(text);
  const points=filtered.detected?deductCommunityPoints(userId):currentPoints;
  if(filtered.detected){state.strikes+=1;if(state.strikes>=3)state.suspendedUntil=now+30*60*1000;chatDiscipline.set(userId,state)}
  return {...filtered,blocked:false,strikes:state.strikes,suspendedUntil:state.suspendedUntil,points};
}
function sendChatWarning(socket,result) {
  if(!result.detected&&!result.blocked)return;
  socket.send(JSON.stringify({type:'chat-warning',strikes:result.strikes,suspendedUntil:result.suspendedUntil,blocked:result.blocked,scoreBlocked:result.scoreBlocked,points:result.points,message:result.scoreBlocked?'Text chat locked: behaviour score is below 2,000':result.suspendedUntil?'Chat suspended for 30 minutes':`Warning ${result.strikes}/3: inappropriate language was filtered (-200 points)`}));
}
function broadcastChannelPresence(room){
  const set=channelSockets.get(room); if(!set) return;
  const members=[...set].map(client=>client.lingoUserId).filter(Boolean).map(uid=>userIdentities.get(uid)).filter(Boolean).map(user=>({...publicUser(user),behaviorPoints:getCommunityScore(user.uid)}));
  const unique=[...new Map(members.map(user=>[user.uid,user])).values()];
  const payload=JSON.stringify({type:'channel-presence',room,members:unique});
  set.forEach(client=>{if(client.readyState===WebSocket.OPEN)client.send(payload)});
}
function rememberRoomProfile(state,clientId,user){
  if(!state.profiles)state.profiles=new Map();
  if(user?.uid&&userIdentities.has(String(user.uid)))state.profiles.set(clientId,publicUser(userIdentities.get(String(user.uid))));
}
function profileForClient(state,clientId){return state?.profiles?.get(clientId)||null}
const wss = new WebSocketServer({ server, path:'/ws', maxPayload:3 * 1024 * 1024 });
wss.on('connection', (socket,req) => {
  const socketIp=requestIp(req);
  socket.remoteIpHash=isBanEligibleIp(socketIp)?ipHash(socketIp):'';
  if(isIpBanned(socketIp)){
    socket.send(JSON.stringify({type:'access-blocked',message:'Access is blocked for this network'}));
    socket.close(1008,'Network banned');
    return;
  }
  let userId = null;
  let joinedChannel = null;
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) { return; }
    if (message.type === 'hello' && message.user?.id) {
      userId = String(message.user.id).slice(0,128);
      socket.lingoUserId=userId;
      chatClients.set(userId,socket);
      socket.send(JSON.stringify({type:'ready',userId}));
      const discipline=chatDiscipline.get(userId)||{strikes:0,suspendedUntil:0};
      socket.send(JSON.stringify({type:'community-status',points:getCommunityScore(userId),strikes:discipline.strikes,suspendedUntil:discipline.suspendedUntil,scoreBlocked:getCommunityScore(userId)<2000}));
      const queued = offlineMessages.get(userId) || [];
      queued.forEach(item => socket.send(JSON.stringify(item)));
      offlineMessages.delete(userId);
      return;
    }
    if (message.type === 'direct-message' && userId && message.to) {
      if(chatBlocks.get(userId)?.has(String(message.to))||chatBlocks.get(String(message.to))?.has(userId)){socket.send(JSON.stringify({type:'message-error',code:'blocked',message:'Messages are disabled for this conversation'}));return}
      const discipline=chatDiscipline.get(userId)||{strikes:0,suspendedUntil:0};
      const filtered=message.kind==='file'?{clean:'',detected:false,blocked:discipline.suspendedUntil>Date.now(),strikes:discipline.strikes,suspendedUntil:discipline.suspendedUntil,points:getCommunityScore(userId)}:moderateChat(userId,message.text);
      if(filtered.blocked){sendChatWarning(socket,filtered);return}
      const clean = {
        type:'direct-message', id:String(message.id || Date.now()), from:userId, to:String(message.to).slice(0,128),
        senderName:String(message.senderName || 'Friend').slice(0,60), senderAvatar:String(message.senderAvatar || '').slice(0,1000),
        kind:['text','file'].includes(message.kind) ? message.kind : 'text', text:filtered.clean, profanityDetected:filtered.detected, strikes:filtered.strikes,
        fileName:String(message.fileName || '').slice(0,180), mime:String(message.mime || '').slice(0,100),
        fileData:message.kind === 'file' ? String(message.fileData || '').slice(0,2800000) : '', timestamp:Date.now()
      };
      const recipient = chatClients.get(clean.to);
      if (recipient?.readyState === WebSocket.OPEN) recipient.send(JSON.stringify(clean));
      else { const queue=offlineMessages.get(clean.to)||[]; queue.push(clean); offlineMessages.set(clean.to,queue.slice(-30)); }
      sendLiveNotification(clean.to,{title:`Message from ${clean.senderName}`,body:clean.kind==='file'?`${clean.senderName} sent a file`:clean.text,from:userId,notificationKind:'direct-message'});
      socket.send(JSON.stringify({...clean,type:'message-sent'}));
      sendChatWarning(socket,filtered);
    }
    if(message.type==='block-user'&&userId&&message.target){const target=String(message.target).slice(0,128),set=chatBlocks.get(userId)||new Set();if(message.blocked)set.add(target);else set.delete(target);chatBlocks.set(userId,set);saveChatBlocks();socket.send(JSON.stringify({type:'block-updated',target,blocked:!!message.blocked}))}
    if(message.type==='join-channel'&&message.room){
      if(joinedChannel){ channelSockets.get(joinedChannel)?.delete(socket); broadcastChannelPresence(joinedChannel); }
      joinedChannel=String(message.room).slice(0,160);const set=channelSockets.get(joinedChannel)||new Set();set.add(socket);channelSockets.set(joinedChannel,set);
      broadcastChannelPresence(joinedChannel);
      if(userId){const user=userIdentities.get(userId);acceptedFriendIds(userId).forEach(friendId=>sendLiveNotification(friendId,{title:`${user?.name||'A friend'} joined a channel`,body:`They joined ${joinedChannel}.`,from:userId,notificationKind:'channel-join',room:joinedChannel}))}
    }
    if(message.type==='channel-message'&&userId&&joinedChannel){
      touchChannel(joinedChannel);
      const filtered=moderateChat(userId,message.text);if(filtered.blocked){sendChatWarning(socket,filtered);return}const outgoing={type:'channel-message',id:String(message.id||Date.now()),room:joinedChannel,from:userId,senderName:String(message.senderName||'Member').slice(0,60),text:filtered.clean,profanityDetected:filtered.detected,strikes:filtered.strikes,timestamp:Date.now()};
      channelSockets.get(joinedChannel)?.forEach(client=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(outgoing))});
      sendChatWarning(socket,filtered);
    }
    if(message.type==='channel-voice'&&userId&&joinedChannel){
      const outgoing={type:'channel-voice',room:joinedChannel,from:userId,clientId:String(message.clientId||'').slice(0,128),speaking:!!message.speaking,timestamp:Date.now()};
      channelSockets.get(joinedChannel)?.forEach(client=>{if(client!==socket&&client.readyState===WebSocket.OPEN)client.send(JSON.stringify(outgoing))});
    }
    if(message.type==='channel-activity'&&userId&&joinedChannel){
      const allowed=['activity-tab','chess','cards','draw','draw-clear','screen-status','pomodoro'];
      const activity=String(message.activity||'').slice(0,40);
      if(!allowed.includes(activity))return;
      const outgoing={type:'channel-activity',room:joinedChannel,from:userId,activity,payload:message.payload||{},timestamp:Date.now()};
      channelSockets.get(joinedChannel)?.forEach(client=>{if(client!==socket&&client.readyState===WebSocket.OPEN)client.send(JSON.stringify(outgoing))});
    }
  });
  socket.on('close',() => { if(userId && chatClients.get(userId)===socket) chatClients.delete(userId);if(joinedChannel){channelSockets.get(joinedChannel)?.delete(socket);broadcastChannelPresence(joinedChannel)} });
});

removeExpiredChannels();setInterval(removeExpiredChannels,60*60*1000).unref();
server.listen(port, host, () => {
  const shownHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`LingoLoop running at http://${shownHost}:${port}`);
});
