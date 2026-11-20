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
