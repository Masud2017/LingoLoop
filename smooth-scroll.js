document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="#"]');if(!link)return;
  const id=link.getAttribute('href');if(!id||id==='#')return;
  const target=document.querySelector(id);if(!target)return;
  event.preventDefault();
  const offset=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
  window.scrollTo({top:target.getBoundingClientRect().top+scrollY-offset-12,behavior:'smooth'});
  history.replaceState(null,'',id);
});
