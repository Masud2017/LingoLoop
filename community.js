function communityToast(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(communityToast.timer);communityToast.timer=setTimeout(()=>toast.classList.remove('show'),2800)}
const communityUser=()=>window.lingoUser||null;
async function api(path,options={}){const response=await fetch(path,{headers:{'Content-Type':'application/json'},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Request failed');return data}
function renderSocialItem(item,type='shout'){
  const article=document.createElement('article');article.className=type==='blog'?'blog-item':'lingoshout-item';
  const shareUrl=`${location.origin}${location.pathname}#${type}/${item.id}`;
  article.innerHTML=`<header><b>${item.author?.name||'Learner'}</b><small>${new Date(item.createdAt).toLocaleDateString()}</small></header>${type==='blog'?`<h3>${item.title}</h3>`:''}<p>${type==='blog'?item.content:item.text}</p><div class="social-actions"><button data-action="like">Like (${item.likes?.length||0})</button><button data-action="unlike">Unlike</button><button data-action="comment">Comment</button><a href="https://twitter.com/intent/tweet?text=${encodeURIComponent((type==='blog'?item.title:item.text)+' '+shareUrl)}" target="_blank" rel="noopener">Share</a></div><div class="comment-list">${(item.comments||[]).slice(-3).map(comment=>`<small><b>${comment.author?.name||'Learner'}:</b> ${comment.text}</small>`).join('')}</div>`;
  article.querySelector('[data-action="like"]').addEventListener('click',()=>socialAction(type,item.id,'like'));
  article.querySelector('[data-action="unlike"]').addEventListener('click',()=>socialAction(type,item.id,'unlike'));
  article.querySelector('[data-action="comment"]').addEventListener('click',()=>{const text=prompt('Write a comment');if(text)socialAction(type,item.id,'comment',text)});
  return article;
}
async function socialAction(type,id,action,text=''){const user=communityUser();if(!user)return communityToast('Log in first');await api(`/api/${type==='blog'?'blogs':'lingoshouts'}/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({uid:user.id,action,text})});type==='blog'?loadBlogs():loadShouts()}
async function loadShouts(){const feed=document.getElementById('lingoshoutFeed');if(!feed)return;try{const data=await api('/api/lingoshouts');feed.innerHTML='';if(!data.items?.length){feed.innerHTML='<p>No LingoShouts yet.</p>';return}data.items.forEach(item=>feed.appendChild(renderSocialItem(item,'shout')))}catch(error){feed.innerHTML='<p>LingoShouts unavailable.</p>'}}
async function loadBlogs(){const feed=document.getElementById('blogFeed');if(!feed)return;try{const data=await api('/api/blogs');feed.innerHTML='';if(!data.items?.length){feed.innerHTML='<p>No blogs published yet.</p>';return}data.items.forEach((item,index)=>{const node=renderSocialItem(item,'blog');if(index%2===0&&!document.documentElement.classList.contains('ad-free-active')){const ad=document.createElement('div');ad.className='news-item google-ad-card';ad.dataset.adZone='';ad.innerHTML='<a>Blog ad slot</a><span>Revenue from this blog ad is tracked separately; 80% belongs to the blog creator.</span>';feed.appendChild(ad)}feed.appendChild(node)})}catch(error){feed.innerHTML='<p>Blogs unavailable.</p>'}}
async function loadNews(){const list=document.getElementById('newsList');if(!list)return;list.innerHTML='<p>Loading trusted headlines...</p>';try{const data=await api('/api/news');list.innerHTML='';if(!data.items?.length){list.innerHTML='<p>No trusted headlines found right now.</p>';return}const grouped=data.items.reduce((groups,item)=>{(groups[item.source]||=[]).push(item);return groups},{});Object.entries(grouped).forEach(([source,items])=>{const group=document.createElement('section');group.className='news-source-group';const heading=document.createElement('h4');heading.textContent=`${source} - ${items.length} headlines`;group.appendChild(heading);items.forEach(item=>{const row=document.createElement('article');row.className='news-item';if(item.image){row.classList.add('news-item-with-image');const image=document.createElement('img');image.className='news-thumb';image.src=item.image;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{image.remove();row.classList.remove('news-item-with-image')});row.appendChild(image)}const body=document.createElement('div');body.className='news-copy';const link=document.createElement('a');link.href=item.link;link.target='_blank';link.rel='noopener';link.textContent=item.title;const meta=document.createElement('span');meta.textContent=`${item.source}${item.pubDate?` - ${new Date(item.pubDate).toLocaleDateString()}`:''}`;body.append(link,meta);(item.paragraphs||[]).slice(0,2).forEach(paragraph=>{const p=document.createElement('p');p.textContent=paragraph;body.appendChild(p)});row.appendChild(body);group.appendChild(row)});list.appendChild(group)})}catch(error){console.warn('News load failed',error);list.innerHTML='<section class="news-source-group"><h4>BBC - fallback</h4><article class="news-item"><a href="https://www.bbc.com/news" target="_blank" rel="noopener">Open BBC latest news</a><span>Trusted source fallback</span><p>Live headlines could not be loaded from this environment. Use this link for current BBC coverage.</p></article></section><section class="news-source-group"><h4>Al Jazeera - fallback</h4><article class="news-item"><a href="https://www.aljazeera.com/news/" target="_blank" rel="noopener">Open Al Jazeera latest news</a><span>Trusted source fallback</span><p>Live headlines could not be loaded from this environment. Use this link for current Al Jazeera coverage.</p></article></section>'}}
document.addEventListener('submit',async event=>{
  const form=event.target.closest?.('[data-lingoshout-form]');
  if(!form)return;
  event.preventDefault();
  const user=communityUser(),input=form.querySelector('[data-lingoshout-input]'),button=form.querySelector('button[type="submit"]'),text=input?.value.trim()||'';
  if(!user)return communityToast('Log in to post a LingoShout');
  if(!text){input?.focus();return communityToast('Write something before shouting');}
  try{
    if(button)button.disabled=true;
    await api('/api/lingoshouts',{method:'POST',body:JSON.stringify({uid:user.id,name:user.name,avatar:user.avatar,text})});
    form.reset();
    communityToast('LingoShout posted');
    await loadShouts();
  }catch(error){
    communityToast(error.message||'Could not post LingoShout');
  }finally{
    if(button)button.disabled=false;
  }
});
document.getElementById('blogForm')?.addEventListener('submit',async event=>{event.preventDefault();const user=communityUser(),title=document.getElementById('blogTitle').value.trim(),content=document.getElementById('blogBody').value.trim();if(!user)return communityToast('Log in to publish a blog');if(!title||!content)return;await api('/api/blogs',{method:'POST',body:JSON.stringify({uid:user.id,title,content})});event.currentTarget.reset();communityToast('Blog published');loadBlogs()});
document.getElementById('payoutForm')?.addEventListener('submit',async event=>{event.preventDefault();const user=communityUser();if(!user)return communityToast('Log in first');await api('/api/payout-info',{method:'POST',body:JSON.stringify({uid:user.id,iban:document.getElementById('payoutIban').value,country:document.getElementById('payoutCountry').value,legalName:document.getElementById('payoutName').value})});communityToast('Payout info saved for review')});
function setBlogPage(open){const page=document.getElementById('blogs');if(!page)return;if(open){const creator=document.getElementById('creator');creator?.classList.remove('open');creator?.setAttribute('aria-hidden','true');document.body.classList.remove('coffee-page-open')}page.classList.toggle('open',open);page.setAttribute('aria-hidden',String(!open));document.body.classList.toggle('blog-page-open',open);if(open)loadBlogs()}
function syncBlogRoute(){setBlogPage(location.hash==='#blogs'||location.hash.startsWith('#blog/'))}
document.getElementById('closeBlogPage')?.addEventListener('click',()=>{history.replaceState(null,'','#rooms');syncBlogRoute();document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})});
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href="#blogs"]');
  if(!link)return;
  event.preventDefault();
  history.pushState(null,'','#blogs');
  syncBlogRoute();
});
window.addEventListener('hashchange',syncBlogRoute);
window.addEventListener('popstate',syncBlogRoute);
window.addEventListener('lingo-auth-changed',()=>{loadNews();loadShouts();loadBlogs()});
loadShouts();loadBlogs();loadNews();
syncBlogRoute();

