/* Interacciones de la landing: revelado por IntersectionObserver, header, menú móvil y navegación activa. */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initReveal() {
    const items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    items.forEach((el) => {
      const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
      const index = Math.min(siblings.indexOf(el), 5);
      el.style.setProperty('--reveal-delay', `${index * 70}ms`);
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        observer.unobserve(el);
        el.addEventListener('transitionend', function done(e) {
          if (e.target !== el || e.propertyName !== 'opacity') return;
          el.removeAttribute('data-reveal');
          el.style.removeProperty('--reveal-delay');
          el.removeEventListener('transitionend', done);
        });
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    items.forEach((el) => observer.observe(el));
  }

  function initHeader() {
    const header = document.querySelector('header');
    const hero = document.getElementById('hero');
    if (!header || !hero || !('IntersectionObserver' in window)) return;
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:8px;width:1px;';
    hero.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-scrolled', !entry.isIntersecting);
    }).observe(sentinel);
  }

  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    const setOpen = (open) => {
      links.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      toggle.innerHTML = open
        ? '<i class="fas fa-xmark" aria-hidden="true"></i>'
        : '<i class="fas fa-bars" aria-hidden="true"></i>';
    };

    toggle.addEventListener('click', () => setOpen(!links.classList.contains('active')));
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  function initActiveNav() {
    const navItems = document.querySelectorAll('.nav-links a[href^="#"]');
    if (!navItems.length || !('IntersectionObserver' in window)) return;
    const byId = new Map(Array.from(navItems).map((a) => [a.getAttribute('href').slice(1), a]));

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const link = byId.get(entry.target.id);
        if (!link) return;
        navItems.forEach((a) => a.classList.remove('active'));
        link.classList.add('active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    byId.forEach((_, id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  /** Pauses the phone screen cycle while it is off-screen or motion is reduced. */
  function initPhoneCycle() {
    const phone = document.getElementById('phone-mockup');
    if (!phone || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([entry]) => {
      phone.classList.toggle('is-paused', !entry.isIntersecting || reduceMotion.matches);
    }).observe(phone);
  }

  function initYear() {
    const year = document.getElementById('year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  initReveal();
  initHeader();
  initMobileMenu();
  initActiveNav();
  initPhoneCycle();
  initYear();
})();
