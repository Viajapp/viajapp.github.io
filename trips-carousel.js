// Flechas laterales del carrusel de viajes: aparecen solo si hay overflow y se deshabilitan en los extremos.
const EDGE_TOLERANCE_PX = 4;

function scrollStep(list) {
  const card = list.querySelector('.trip-card');
  if (!card) return list.clientWidth;
  const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
  const cardStep = card.getBoundingClientRect().width + gap;
  // Avanza tantas cards completas como entren en pantalla (mínimo una).
  return Math.max(1, Math.floor(list.clientWidth / cardStep)) * cardStep;
}

export function initTripsCarousel(list) {
  const carousel = list.closest('.trips-carousel');
  if (!carousel) return;
  const prev = carousel.querySelector('.trips-nav--prev');
  const next = carousel.querySelector('.trips-nav--next');

  const update = () => {
    const maxScroll = list.scrollWidth - list.clientWidth;
    const overflows = maxScroll > EDGE_TOLERANCE_PX;
    prev.hidden = !overflows;
    next.hidden = !overflows;
    carousel.classList.toggle('has-overflow', overflows);
    prev.disabled = list.scrollLeft <= EDGE_TOLERANCE_PX;
    next.disabled = list.scrollLeft >= maxScroll - EDGE_TOLERANCE_PX;
  };

  prev.addEventListener('click', () => list.scrollBy({ left: -scrollStep(list), behavior: 'smooth' }));
  next.addEventListener('click', () => list.scrollBy({ left: scrollStep(list), behavior: 'smooth' }));
  list.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(list);
  update();
}
