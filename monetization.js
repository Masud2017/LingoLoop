const AD_FREE_KEY = 'lingoloop-ad-free-subscription';
const CHECKOUT_URL_KEY = 'lingoloop-subscription-checkout-url';
const STUDY_PREMIUM_UNLOCK_KEY = 'lingoloop-study-helper-premium';

function monetizationToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(monetizationToast.timer);
  monetizationToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function hasAdFree() {
  try {
    const plan = JSON.parse(localStorage.getItem(AD_FREE_KEY) || 'null');
    return !!plan?.active;
  } catch (_) {
    return false;
  }
}

function saveAdFree(active) {
  if (active) {
    localStorage.setItem(AD_FREE_KEY, JSON.stringify({
      active: true,
      price: 5,
      currency: 'EUR',
      interval: 'month',
      updatedAt: Date.now(),
      source: 'local-preview'
    }));
    localStorage.setItem(STUDY_PREMIUM_UNLOCK_KEY,'active');
  } else {
    localStorage.removeItem(AD_FREE_KEY);
    localStorage.removeItem(STUDY_PREMIUM_UNLOCK_KEY);
  }
}

function applyAdFreeState() {
  const active = hasAdFree();
  document.documentElement.classList.toggle('ad-free-active', active);
  const status = active ? 'Ad-free plan active: Google ads are hidden.' : 'Free plan: ads are visible.';
  document.getElementById('adFreeStatus')?.replaceChildren(document.createTextNode(status));
  document.getElementById('settingsAdFreeStatus')?.replaceChildren(document.createTextNode(status));
  const subscribeText = active ? 'Ad-free active' : 'Go ad-free';
  ['subscribeAdFree','settingsSubscribeAdFree'].forEach(id => {
    const button = document.getElementById(id);
    if (!button) return;
    button.disabled = active;
    if (id === 'settingsSubscribeAdFree') button.textContent = subscribeText;
    else button.innerHTML = active ? '<span class="material-symbols-rounded">verified</span> Ad-free active' : '<span class="material-symbols-rounded">credit_card</span> Go ad-free';
  });
  const restore = document.getElementById('restoreAds');
  if (restore) restore.hidden = !active;
  if (!active) requestAdsense();
}

function requestAdsense() {
  window.adsbygoogle = window.adsbygoogle || [];
  document.querySelectorAll('ins.adsbygoogle:not([data-ad-requested])').forEach(slot => {
    slot.dataset.adRequested = 'true';
    try { window.adsbygoogle.push({}); }
    catch (error) { console.warn('AdSense request skipped', error); }
  });
}

function startAdFreeSubscription() {
  const checkoutUrl = localStorage.getItem(CHECKOUT_URL_KEY) || window.LINGOLOOP_SUBSCRIPTION_URL || '';
  if (checkoutUrl) {
    window.open(checkoutUrl, '_blank', 'noopener');
    monetizationToast('Opening secure EUR5/month checkout...');
    return;
  }
  saveAdFree(true);
  applyAdFreeState();
  monetizationToast('Ad-free mode enabled. Connect Stripe or PayPal checkout before production.');
}

document.getElementById('subscribeAdFree')?.addEventListener('click', startAdFreeSubscription);
document.getElementById('settingsSubscribeAdFree')?.addEventListener('click', startAdFreeSubscription);
document.getElementById('subscribeCrypto')?.addEventListener('click',()=>monetizationToast('Crypto subscription placeholder ready: connect Coinbase Commerce, Binance Pay, or NOWPayments before production.'));
document.getElementById('restoreAds')?.addEventListener('click', () => {
  saveAdFree(false);
  applyAdFreeState();
  monetizationToast('Ads are visible again.');
});

window.addEventListener('lingo-auth-changed', applyAdFreeState);
applyAdFreeState();
