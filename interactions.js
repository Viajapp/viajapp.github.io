/* Interacciones con el mouse: tilt con brillo en cards, botones magnéticos, parallax del hero,
   halo que sigue al cursor, indicador de navegación y barra de progreso de scroll.
   Solo con puntero fino y sin "reducir movimiento"; todo se agrupa en un único requestAnimationFrame. */
(() => {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TILT = '.feature-card, .trust-card, .testimonial-card, .trip-card, .download-card, .float-card';
  const MAGNET = '.btn, .mobile-menu-toggle, .social-link-large a, .footer-links a, .nav-links a';
  const INTERACTIVE = `${MAGNET}, ${TILT}, a, button`;
  const MAX_TILT = 7;

  function initScrollProgress() {
    const bar = document.querySelector('.scroll-progress');
    if (!bar) return;
    let queued = false;
    const update = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  initScrollProgress();
  if (!fine.matches || reduce.matches) return;
  document.documentElement.classList.add('fx');

  const halo = document.createElement('div');
  halo.className = 'cursor-halo';
  halo.setAttribute('aria-hidden', 'true');
  document.body.appendChild(halo);

  const hero = document.getElementById('hero');
  const pointer = { x: -999, y: -999, target: null };
  const haloPos = { x: -999, y: -999 };
  let tiltEl = null;
  let magnetEl = null;
  let frame = 0;

  function tilt(el) {
    const r = el.getBoundingClientRect();
    const px = (pointer.x - r.left) / r.width;
    const py = (pointer.y - r.top) / r.height;
    const max = MAX_TILT * Math.min(1, 380 / r.width);
    el.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  }

  function releaseTilt(el) {
    el.classList.remove('is-tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  function magnet(el) {
    const r = el.getBoundingClientRect();
    const dx = (pointer.x - (r.left + r.width / 2)) / r.width;
    const dy = (pointer.y - (r.top + r.height / 2)) / r.height;
    el.style.translate = `${(dx * 10).toFixed(1)}px ${(dy * 8).toFixed(1)}px`;
  }

  function parallax() {
    if (!hero) return;
    const r = hero.getBoundingClientRect();
    if (pointer.y < r.top || pointer.y > r.bottom) return;
    const px = ((pointer.x - r.left) / r.width - 0.5) * 2;
    const py = ((pointer.y - r.top) / r.height - 0.5) * 2;
    hero.style.setProperty('--px', px.toFixed(3));
    hero.style.setProperty('--py', py.toFixed(3));
  }

  function tick() {
    frame = 0;
    const target = pointer.target;

    const nextTilt = target ? target.closest(TILT) : null;
    if (nextTilt !== tiltEl) {
      if (tiltEl) releaseTilt(tiltEl);
      tiltEl = nextTilt;
      if (tiltEl) {
        tiltEl.classList.add('fx-tilt', 'is-tilting');
        if (!tiltEl.querySelector(':scope > .fx-glare')) {
          const glare = document.createElement('span');
          glare.className = 'fx-glare';
          glare.setAttribute('aria-hidden', 'true');
          tiltEl.appendChild(glare);
        }
      }
    }
    if (tiltEl) tilt(tiltEl);

    const nextMagnet = target ? target.closest(MAGNET) : null;
    if (nextMagnet !== magnetEl) {
      if (magnetEl) magnetEl.style.translate = '';
      magnetEl = nextMagnet;
    }
    if (magnetEl) magnet(magnetEl);

    parallax();

    haloPos.x += (pointer.x - haloPos.x) * 0.2;
    haloPos.y += (pointer.y - haloPos.y) * 0.2;
    halo.style.transform = `translate3d(${haloPos.x.toFixed(1)}px, ${haloPos.y.toFixed(1)}px, 0)`;
    halo.classList.toggle('is-active', Boolean(target && target.closest(INTERACTIVE)));
    if (Math.abs(pointer.x - haloPos.x) + Math.abs(pointer.y - haloPos.y) > 0.5) schedule();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (haloPos.x < -900) {
      haloPos.x = e.clientX;
      haloPos.y = e.clientY;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.target = e.target instanceof Element ? e.target : null;
    halo.classList.add('is-visible');
    schedule();
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', () => {
    pointer.target = null;
    halo.classList.remove('is-visible');
    if (hero) {
      hero.style.setProperty('--px', '0');
      hero.style.setProperty('--py', '0');
    }
    schedule();
  });

  window.addEventListener('scroll', () => {
    if (!pointer.target) return;
    pointer.target = document.elementFromPoint(pointer.x, pointer.y);
    schedule();
  }, { passive: true });

  initNavIndicator();

  /** Navy-soft pill that slides under the hovered link and rests on the active one. */
  function initNavIndicator() {
    const nav = document.getElementById('nav-links');
    if (!nav) return;
    const pill = document.createElement('span');
    pill.className = 'nav-indicator';
    pill.setAttribute('aria-hidden', 'true');
    nav.prepend(pill);
    nav.classList.add('has-indicator');

    const moveTo = (link) => {
      if (!link) {
        pill.style.opacity = '0';
        return;
      }
      pill.style.opacity = '1';
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.height = `${link.offsetHeight}px`;
      pill.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    };
    const rest = () => moveTo(nav.querySelector('a.active'));

    nav.querySelectorAll('a').forEach((a) => a.addEventListener('mouseenter', () => moveTo(a)));
    nav.addEventListener('mouseleave', rest);
    new MutationObserver(rest).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', rest, { passive: true });
    document.fonts?.ready.then(rest);
    rest();
  }
})();
