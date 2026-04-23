/* ================================================================
   SCRIPT.JS — Tawazun Detailing
   Modules:
     1. Custom Cursor
     2. Scroll Observer
     3. Before/After Sliders
     4. Date Picker
     5. Booking Form
     6. Gallery Navigation
     7. Smart Email Routing (NEW)
================================================================ */


/* ----------------------------------------------------------------
   1. CUSTOM CURSOR
---------------------------------------------------------------- */
(function initCursor() {
  const dot     = document.getElementById('dot');
  const outline = document.getElementById('outline');

  let mouseX = 0;
  let mouseY = 0;
  let outlineX = 0;
  let outlineY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    dot.style.left = mouseX + 'px';
    dot.style.top  = mouseY + 'px';
  });

  function animateOutline() {
    outlineX += (mouseX - outlineX) * 0.15;
    outlineY += (mouseY - outlineY) * 0.15;

    outline.style.left = outlineX + 'px';
    outline.style.top  = outlineY + 'px';

    requestAnimationFrame(animateOutline);
  }

  animateOutline();

  const interactiveEls = document.querySelectorAll('a, button, input, select');

  interactiveEls.forEach((el) => {
    el.addEventListener('mouseenter', () => {
      outline.style.transform = 'translate(-50%, -50%) scale(1.5)';
    });
    el.addEventListener('mouseleave', () => {
      outline.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  });
})();


/* ----------------------------------------------------------------
   2. SCROLL OBSERVER
---------------------------------------------------------------- */
(function initScrollObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fade').forEach((el) => observer.observe(el));
})();


/* ----------------------------------------------------------------
   3. BEFORE / AFTER SLIDERS
---------------------------------------------------------------- */
(function initBeforeAfterSliders() {
  const slides = document.querySelectorAll('.slider-container');
  if (!slides.length) return;

  slides.forEach((container) => {
    const rangeInput = container.querySelector('.sliderRange');
    const beforeBox  = container.querySelector('.before-image');
    if (!rangeInput || !beforeBox) return;

    let lastValue = parseFloat(rangeInput.value);

    function updateSlider() {
      const value = parseFloat(rangeInput.value);
      beforeBox.style.width = value + '%';

      // Haptic API: vibrate(10ms) when slider hits its min or max boundary
      const atMin = value <= 0;
      const atMax = value >= 100;
      const crossedBoundary = (atMin && lastValue > 0) || (atMax && lastValue < 100);

      if (crossedBoundary && navigator.vibrate) {
        navigator.vibrate(10);
      }

      lastValue = value;
    }

    rangeInput.addEventListener('input', updateSlider);

    rangeInput.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    }, { passive: true });

    updateSlider();
  });
})();


/* ----------------------------------------------------------------
   4. DATE PICKER
---------------------------------------------------------------- */
(function initDatePicker() {
  const dateInput = document.querySelector('.booking-form input[type="date"]');
  if (!dateInput) return;

  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;

  dateInput.addEventListener('click', () => {
    if (typeof dateInput.showPicker === 'function') {
      try {
        dateInput.showPicker();
      } catch (err) {}
    }
  });
})();


/* ----------------------------------------------------------------
   5. BOOKING FORM
---------------------------------------------------------------- */
(function initBookingForm() {
  const form         = document.querySelector('.booking-form');
  const confirmation = document.getElementById('bookingConfirmation');
  const confirmText  = document.getElementById('confirmText');

  if (!form || !confirmation || !confirmText) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const packageSelect  = form.querySelector('select');
    const dateInput      = form.querySelector('input[type="date"]');
    const descTextarea   = form.querySelector('.booking-textarea');

    const packageName  = packageSelect?.value || 'your chosen package';
    const selectedDate = dateInput?.value
      ? new Date(dateInput.value + 'T00:00:00').toLocaleDateString('en-AU', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
      : 'your selected date';
    const description = descTextarea?.value.trim() || '';

    confirmText.textContent =
      `Thank you! We've received your request for the ${packageName} on ${selectedDate}.`
      + (description ? ` We noted: "${description}".` : '')
      + ' We will text you shortly to confirm the details.';

    form.style.display         = 'none';
    confirmation.style.display = 'flex';
  });
})();


/* ----------------------------------------------------------------
   6. GALLERY NAVIGATION
   Momentum scrolling + snap-aware dot sync.
   Uses requestAnimationFrame polling for perfect sync with
   native CSS scroll-snap (no scroll-end event needed).
---------------------------------------------------------------- */
(function initGalleryNav() {
  const carousel = document.querySelector('.gallery-carousel');
  const prevBtn  = document.querySelector('.nav-btn.prev');
  const nextBtn  = document.querySelector('.nav-btn.next');
  const dots     = document.querySelectorAll('.dot');

  if (!carousel || !prevBtn || !nextBtn) return;

  const totalSlides = carousel.querySelectorAll('.gallery-slide').length;

  // ── Arrow navigation: jump exactly one slide width ──
  nextBtn.addEventListener('click', () => {
    carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' });
  });

  prevBtn.addEventListener('click', () => {
    carousel.scrollBy({ left: -carousel.clientWidth, behavior: 'smooth' });
  });

  // ── Dot sync via rAF polling — keeps up with native snap momentum ──
  let rafId = null;
  let lastIndex = -1;

  function syncDots() {
    const slideWidth = carousel.clientWidth;
    if (slideWidth === 0) { rafId = requestAnimationFrame(syncDots); return; }

    const rawIndex = carousel.scrollLeft / slideWidth;
    const index    = Math.min(Math.round(rawIndex), totalSlides - 1);

    if (index !== lastIndex) {
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
      lastIndex = index;
    }

    rafId = requestAnimationFrame(syncDots);
  }

  // Start polling while the carousel is visible
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(syncDots);
      } else {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }
    });
  }, { threshold: 0.1 });

  visibilityObserver.observe(carousel);

  // ── Momentum / fluid touch: enable passive touch listeners for
  //    unblocked native momentum scrolling on iOS & Android ──
  carousel.addEventListener('touchstart', () => {}, { passive: true });
  carousel.addEventListener('touchmove',  () => {}, { passive: true });
})();


/* ----------------------------------------------------------------
   7. SMART EMAIL ROUTING (NEW)
   Mobile → system mail app (default mailto: behaviour)
   Desktop → Gmail compose in new tab
   Detection uses both UA string and pointer precision (coarse = touch)
---------------------------------------------------------------- */
(function initSmartEmail() {
  const links = document.querySelectorAll('.smart-email');
  if (!links.length) return;

  function isMobileDevice() {
    // Primary: media query for coarse pointer (touch screens)
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    // Secondary: UA string for older Android / iOS browsers
    const uaIsMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return hasCoarsePointer || uaIsMobile;
  }

  links.forEach(link => {
    link.addEventListener('click', function (e) {
      const email = this.dataset.email;
      if (!email) return;

      if (!isMobileDevice()) {
        // Desktop: open Gmail compose window
        e.preventDefault();
        window.open(
          `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
      // Mobile: allow default mailto: to open the native mail app
    });
  });
})();