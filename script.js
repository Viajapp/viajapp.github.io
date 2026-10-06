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

  /** Messages of the two floating cards for each phone screen, in screen order. */
  const FLOAT_CARD_MESSAGES = [
    [['navy', 'fa-magnifying-glass', 'Buscá tu viaje', 'Filtrá por fecha y horario'],
      ['coral', 'fa-box', 'También paquetes', 'Enviá con quien ya viaja']],
    [['navy', 'fa-location-dot', 'Cerca tuyo', 'Viajes según tu ubicación'],
      ['coral', 'fa-bell', 'Dejá un aviso', 'Te avisamos cuando aparezca uno']],
    [['green', 'fa-user-check', 'Conductor verificado', 'Identidad validada con Nosis'],
      ['coral', 'fa-star', 'Valoraciones reales', 'Después de cada viaje']],
    [['green', 'fa-circle-check', '¡Reserva enviada!', 'Pagaste con Mercado Pago'],
      ['coral', 'fa-rotate-left', 'Sin riesgo', 'Si te rechazan, se devuelve']],
    [['green', 'fa-check', '¡Viaje publicado!', 'Ya está visible para pasajeros'],
      ['coral', 'fa-hand-holding-dollar', 'Compartí gastos', 'Vos ponés el precio por asiento']],
    [['navy', 'fa-comment', 'Nuevo mensaje', '¿Nos vemos en la terminal?'],
      ['coral', 'fa-location-arrow', 'Ubicación en vivo', 'Compartila durante el viaje']],
  ];

  /** Swaps the floating cards' content each time a phone screen fades in. */
  function initFloatCards() {
    const phone = document.getElementById('phone-mockup');
    const cards = [document.querySelector('.float-card--top'), document.querySelector('.float-card--bottom')];
    if (!phone || cards.some((c) => !c)) return;

    const fill = (card, [tone, icon, title, subtitle]) => {
      const tile = card.querySelector('.icon-tile');
      tile.className = `icon-tile${tone === 'coral' ? '' : ` icon-tile--${tone}`}`;
      tile.querySelector('i').className = `fas ${icon}`;
      card.querySelector('strong').textContent = title;
      card.querySelector('small').textContent = subtitle;
    };

    const show = (index) => {
      const messages = FLOAT_CARD_MESSAGES[index];
      if (!messages) return;
      cards.forEach((card, i) => {
        if (card.querySelector('strong').textContent === messages[i][2]) return;
        card.classList.add('is-swapping');
        setTimeout(() => {
          fill(card, messages[i]);
          card.classList.remove('is-swapping');
        }, 240 + i * 120);
      });
    };

    const screens = Array.from(phone.querySelectorAll('.phone-screen'));
    screens.forEach((screen, index) => {
      screen.addEventListener('animationstart', () => show(index));
      screen.addEventListener('animationiteration', () => show(index));
    });
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
  initFloatCards();
  initYear();
})();
