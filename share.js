const shareButton=document.getElementById('sharePlatformButton');
const shareBackdrop=document.getElementById('shareBackdrop');
const shareUrl=location.origin+location.pathname;
const shareText='Join me on LingoLoop to practice languages through live conversations!';
const encodedUrl=encodeURIComponent(shareUrl),encodedText=encodeURIComponent(shareText);
document.getElementById('shareLink').value=shareUrl;
document.getElementById('shareWhatsApp').href=`https://wa.me/?text=${encodedText}%20${encodedUrl}`;
document.getElementById('shareTelegram').href=`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
document.getElementById('shareFacebook').href=`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
document.getElementById('shareX').href=`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
function setShareOpen(open){shareBackdrop.classList.toggle('open',open);shareBackdrop.setAttribute('aria-hidden',String(!open))}
function shareToast(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');clearTimeout(shareToast.timer);shareToast.timer=setTimeout(()=>toast.classList.remove('show'),2600)}
shareButton.addEventListener('click',()=>setShareOpen(true));
document.getElementById('closeShare').addEventListener('click',()=>setShareOpen(false));
shareBackdrop.addEventListener('click',event=>{if(event.target===shareBackdrop)setShareOpen(false)});
document.addEventListener('keydown',event=>{if(event.key==='Escape')setShareOpen(false)});
document.getElementById('copyShareLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(shareUrl)}catch(_){const input=document.getElementById('shareLink');input.select();document.execCommand('copy')}shareToast('Platform link copied!')});
const moreButton=document.getElementById('shareMore');
if(!navigator.share)moreButton.hidden=true;
moreButton.addEventListener('click',async()=>{try{await navigator.share({title:'LingoLoop - Speak the world',text:shareText,url:shareUrl});setShareOpen(false)}catch(error){if(error.name!=='AbortError')shareToast('Sharing is unavailable right now')}});
