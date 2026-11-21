'use strict';
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  navigation.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') { closeMenu(); menuButton.focus(); } });
matchMedia('(min-width: 681px)').addEventListener('change', closeMenu);
document.querySelectorAll('[data-whatsapp]').forEach(link => {
  const message = link.dataset.message || 'Olá, Rejane! Vim pelo site e gostaria de saber mais sobre seu acompanhamento.';
  link.href = `https://wa.me/5561982920780?text=${encodeURIComponent(message)}`;
});
document.querySelector('#year').textContent = String(new Date().getFullYear());
const photo = document.querySelector('#hero-photo');
const placeholder = document.querySelector('#photo-placeholder');
function showPhoto() { photo.hidden = false; placeholder.hidden = true; placeholder.style.display = 'none'; }
photo.addEventListener('load', showPhoto);
photo.addEventListener('error', () => { photo.hidden = true; placeholder.hidden = false; placeholder.style.display = 'flex'; });
if (photo.complete && photo.naturalWidth > 0) showPhoto();


const plansTrack = document.querySelector('#plans-track');
const planCards = [...plansTrack.querySelectorAll('.plan')];
const planButtons = document.querySelectorAll('[data-plan-direction]');
const planPosition = document.querySelector('.plan-position');
const ring = document.createElement('div');
ring.className = 'plans-ring';
planCards.forEach(card => ring.append(card));
plansTrack.append(ring);
plansTrack.classList.add('is-wheel');
let rotationStep = 0;
let planDrag = null;
let suppressPlanClick = false;
const normalizePlan = value => ((value % planCards.length) + planCards.length) % planCards.length;
function renderPlanWheel(dragOffset = 0) {
  const active = normalizePlan(rotationStep);
  ring.style.setProperty('--wheel-angle', (-rotationStep * 360 / planCards.length + dragOffset) + 'deg');
  planCards.forEach((card, index) => {
    const difference = Math.abs(index - active);
    const distance = Math.min(difference, planCards.length - difference);
    card.classList.toggle('is-active', index === active);
    card.inert = index !== active;
    card.style.setProperty('--wheel-opacity', String(distance === 0 ? 1 : distance === 1 ? 0.55 : 0.22));
    card.style.setProperty('--wheel-blur', distance === 0 ? '0px' : '1px');
  });
  planPosition.textContent = (active + 1) + ' / ' + planCards.length;
}
function movePlans(direction) {
  rotationStep += direction;
  renderPlanWheel();
}
function sizePlanWheel() {
  const width = planCards[0].offsetWidth;
  plansTrack.style.setProperty('--wheel-radius', Math.round(width * 1.05) + 'px');
  const height = Math.max(...planCards.map(card => card.offsetHeight));
  plansTrack.style.height = (height + 90) + 'px';
  ring.style.height = height + 'px';
}
planCards.forEach((card,index) => card.style.setProperty('--wheel-card-angle', (index * 360 / planCards.length) + 'deg'));
planButtons.forEach(button => button.addEventListener('click', () => movePlans(Number(button.dataset.planDirection))));
plansTrack.addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  movePlans(event.key === 'ArrowRight' ? 1 : -1);
});
plansTrack.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  suppressPlanClick = false;
  planDrag = {id:event.pointerId, x:event.clientX, y:event.clientY, moved:false};
});
plansTrack.addEventListener('pointermove', event => {
  if (!planDrag || planDrag.id !== event.pointerId) return;
  const distance = event.clientX - planDrag.x;
  if (!planDrag.moved) {
    if (Math.abs(event.clientY - planDrag.y) > Math.abs(distance) && Math.abs(event.clientY - planDrag.y) > 8) { planDrag = null; return; }
    if (Math.abs(distance) < 8) return;
    planDrag.moved = true;
    plansTrack.setPointerCapture(event.pointerId);
    plansTrack.classList.add('dragging');
  }
  renderPlanWheel(distance / planCards[0].offsetWidth * 60);
});
function finishPlanDrag(event) {
  if (!planDrag || event.pointerId !== planDrag.id) return;
  const finished = planDrag;
  planDrag = null;
  suppressPlanClick = finished.moved;
  plansTrack.classList.remove('dragging');
  if (plansTrack.hasPointerCapture(finished.id)) plansTrack.releasePointerCapture(finished.id);
  if (finished.moved && event.type !== 'pointercancel') {
    const distance = event.clientX - finished.x;
    if (Math.abs(distance) > 35) rotationStep += distance < 0 ? 1 : -1;
  }
  renderPlanWheel();
}
window.addEventListener('pointerup', finishPlanDrag);
window.addEventListener('pointercancel', finishPlanDrag);
plansTrack.addEventListener('lostpointercapture', finishPlanDrag);
plansTrack.addEventListener('dragstart', event => event.preventDefault());
plansTrack.addEventListener('click', event => {
  if (!suppressPlanClick) return;
  event.preventDefault(); event.stopPropagation(); suppressPlanClick = false;
},true);
new ResizeObserver(sizePlanWheel).observe(plansTrack);
planCards.forEach(card => new ResizeObserver(sizePlanWheel).observe(card));
renderPlanWheel();
sizePlanWheel();

const aboutPhoto = document.querySelector('#about-photo');
const aboutCaption = document.querySelector('#about-caption');
const aboutPhotoButtons = document.querySelectorAll('[data-about-photo]');
let aboutPhotoRequest = 0;
aboutPhotoButtons.forEach(button => button.addEventListener('click', () => {
  const request = ++aboutPhotoRequest;
  const image = new Image();
  image.onload = () => {
    if (request !== aboutPhotoRequest) return;
    aboutPhoto.src = image.src;
    aboutPhoto.alt = button.dataset.caption;
    aboutCaption.textContent = button.dataset.caption;
    aboutPhotoButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  };
  image.src = 'assets/sobre/rejane-' + button.dataset.aboutPhoto + '.jpeg';
}));
