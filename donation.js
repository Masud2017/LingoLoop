const coffeeForm=document.getElementById('coffeeForm');
const amountButtons=[...document.querySelectorAll('[data-amount]')];
const customDonation=document.getElementById('customDonation');
let selectedDonation=5;
const donorList=document.getElementById('donorList');
const showDonationPublicly=document.getElementById('showDonationPublicly');
const donorKey='lingoloop-public-donors';
const coffeePage=document.getElementById('creator');
function donorName(){return window.lingoUser?.name||'Anonymous learner'}
function donorAvatar(){return window.lingoUser?.avatar||''}
function readDonors(){try{return JSON.parse(localStorage.getItem(donorKey)||'[]').filter(item=>item.expiresAt>Date.now())}catch(_){return[]}}
function saveDonors(donors){localStorage.setItem(donorKey,JSON.stringify(donors))}
function renderDonors(){if(!donorList)return;const donors=readDonors();saveDonors(donors);donorList.innerHTML='';if(!donors.length){donorList.innerHTML='<p>No public supporters yet. Be the first coffee hero.</p>';return}donors.slice(0,30).forEach(donor=>{const card=document.createElement('article');card.className='donor-card';const avatar=document.createElement('span');avatar.className='donor-avatar';if(donor.avatar){const image=document.createElement('img');image.src=donor.avatar;image.alt='';avatar.appendChild(image)}else avatar.textContent=donor.name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase();const copy=document.createElement('div');copy.innerHTML='<b></b><small></small>';copy.querySelector('b').textContent=donor.name;copy.querySelector('small').textContent=`Supported with $${donor.amount}`;card.append(avatar,copy);donorList.appendChild(card)})}
function setCoffeePage(open){
  if(!coffeePage)return;
  if(open){
    const blogPage=document.getElementById('blogs');
    blogPage?.classList.remove('open');
    blogPage?.setAttribute('aria-hidden','true');
    document.body.classList.remove('blog-page-open');
  }
  coffeePage.classList.toggle('open',open);
  coffeePage.setAttribute('aria-hidden',String(!open));
  document.body.classList.toggle('coffee-page-open',open);
}
function syncCoffeeRoute(){setCoffeePage(location.hash==='#creator'||location.hash==='#coffee')}
function selectDonation(amount,button){selectedDonation=Number(amount);amountButtons.forEach(item=>item.classList.toggle('active',item===button))}
function coffeeToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(coffeeToast.timer);coffeeToast.timer=setTimeout(()=>toast.classList.remove('show'),3500)}
amountButtons.forEach(button=>button.addEventListener('click',()=>{customDonation.value='';selectDonation(button.dataset.amount,button)}));
customDonation.addEventListener('input',()=>{if(customDonation.value)selectDonation(customDonation.value,null)});
coffeeForm.addEventListener('submit',event=>{
  event.preventDefault();
  const config=window.LINGOLOOP_DONATION||{};
  if(!selectedDonation||selectedDonation<1){coffeeToast('Choose a valid support amount');return}
  if(showDonationPublicly?.checked){const donors=readDonors().filter(item=>item.userId!==(window.lingoUser?.id||'guest'));donors.unshift({userId:window.lingoUser?.id||'guest',name:donorName(),avatar:donorAvatar(),amount:selectedDonation,createdAt:Date.now(),expiresAt:Date.now()+30*24*60*60*1000});saveDonors(donors);renderDonors()}
  if(!config.paymentUrl){coffeeToast('Add your payment link in donation-config.js to accept support');return}
  const destination=config.paymentUrl.includes('{amount}')?config.paymentUrl.replace('{amount}',encodeURIComponent(selectedDonation)):config.paymentUrl;
  window.open(destination,'_blank','noopener,noreferrer');
});
document.getElementById('closeCoffeePage')?.addEventListener('click',()=>{history.replaceState(null,'','#rooms');syncCoffeeRoute();document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})});
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href="#creator"],a[href="#coffee"]');
  if(!link)return;
  event.preventDefault();
  history.pushState(null,'',link.getAttribute('href'));
  syncCoffeeRoute();
});
window.addEventListener('hashchange',syncCoffeeRoute);
window.addEventListener('popstate',syncCoffeeRoute);
renderDonors();
syncCoffeeRoute();
