// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// Active nav link
const links = document.querySelectorAll('.nav-links a');
const path = window.location.pathname.split('/').pop() || 'index.html';
links.forEach(l => {
  const href = l.getAttribute('href');
  if (href === path || (path === 'index.html' && href === '/') || (path === '' && href === '/')) {
    l.classList.add('active');
  }
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileClose = document.getElementById('mobileClose');
const mobileLinks = document.querySelectorAll('.nav-mobile a');

hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
  document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
mobileClose?.addEventListener('click', closeMobile);
mobileLinks.forEach(l => l.addEventListener('click', closeMobile));
function closeMobile() {
  hamburger.classList.remove('open');
  mobileMenu.classList.remove('open');
  document.body.style.overflow = '';
}

// Reveal on scroll (getBoundingClientRect : fiable partout)
function revealCheck() {
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight - 40 && r.bottom > 0) el.classList.add('visible');
  });
}
window.addEventListener('scroll', revealCheck, { passive: true });
window.addEventListener('resize', revealCheck);
document.addEventListener('DOMContentLoaded', revealCheck);
revealCheck();
setInterval(revealCheck, 800);
