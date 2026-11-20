// Video play buttons and scroll-linked fade-ins.
document.documentElement.classList.add('js');

for (const box of document.querySelectorAll('.video')) {
  const video = box.querySelector('video');
  const button = box.querySelector('.play');
  if (!video || !button) continue;
  const sync = () => {
    const playing = !video.paused && !video.ended;
    box.classList.toggle('playing', playing);
    button.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
  };
  button.addEventListener('click', () => (video.paused ? video.play() : video.pause()));
  for (const name of ['play', 'playing', 'pause', 'ended']) video.addEventListener(name, sync);
  if (video.autoplay) video.play().catch(() => {});
  sync();
}

// An element starts to fade in when its top edge passes 65% of the window
// height and reaches full opacity after another 25% of scrolling.
const scrollItems = [...document.querySelectorAll('[data-anim="scroll"]')];
if (scrollItems.length) {
  let queued = false;
  const update = () => {
    queued = false;
    const vh = window.innerHeight;
    const atBottom = window.scrollY + vh >= document.documentElement.scrollHeight - 2;
    for (const el of scrollItems) {
      const top = el.getBoundingClientRect().top;
      const progress = atBottom ? 1 : Math.min(1, Math.max(0, (vh * 0.65 - top) / (vh * 0.25)));
      el.style.setProperty('--scroll-opacity', progress.toFixed(3));
    }
  };
  const request = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}

// Links marked data-modal open in a pop-up window on the page. Without this
// script they work as ordinary links.
let browserDialog;
function openBrowser(link) {
  if (!browserDialog) {
    browserDialog = document.createElement('dialog');
    browserDialog.className = 'browser';
    browserDialog.innerHTML =
      '<div class="browser-bar">' +
      '<button type="button" class="browser-close" aria-label="Close">\u00d7</button>' +
      '<div class="browser-address"></div>' +
      '<a class="browser-newtab" target="_blank" rel="noopener">Open in new tab</a>' +
      '</div><iframe></iframe>';
    document.body.append(browserDialog);
    browserDialog.querySelector('.browser-close').addEventListener('click', () => browserDialog.close());
    // A click on the dimmed area outside the window closes it.
    browserDialog.addEventListener('click', (event) => event.target === browserDialog && browserDialog.close());
    browserDialog.addEventListener('close', () => {
      document.documentElement.classList.remove('modal-open');
      browserDialog.querySelector('iframe').removeAttribute('src');
    });
  }
  const title = link.dataset.modalTitle || link.textContent.trim();
  const frame = browserDialog.querySelector('iframe');
  browserDialog.setAttribute('aria-label', title);
  frame.title = title;
  frame.src = link.href;
  browserDialog.querySelector('.browser-address').textContent = link.href.replace(/^https?:\/\//, '');
  browserDialog.querySelector('.browser-newtab').href = link.href;
  document.documentElement.classList.add('modal-open');
  browserDialog.showModal();
}
if (window.HTMLDialogElement) {
  for (const link of document.querySelectorAll('a[data-modal]')) {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      openBrowser(link);
    });
  }
}
