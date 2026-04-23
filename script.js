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
   PERFORMANCE FIXES:
   - mousemove only stores coords — never writes to DOM
   - A single rAF loop writes positions via transform (GPU layer)
   - transform: translate() stays on compositor, avoids layout
   - Passive listener: browser never waits for JS before scrolling
   - isTouchDevice guard: entire module skipped on mobile
---------------------------------------------------------------- */
(function initCursor() {
  // Skip entirely on touch devices — cursor elements are hidden anyway
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const dot     = document.getElementById('dot');
  const outline = document.getElementById('outline');
  if (!dot || !outline) return;

  let mouseX = 0, mouseY = 0;
  let outlineX = 0, outlineY = 0;
  let dotX = 0, dotY = 0;
  let rafRunning = false;

  // Passive: browser scrolls immediately without waiting for this handler
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Start the rAF loop on first move if not already running
    if (!rafRunning) { rafRunning = true; rafLoop(); }
  }, { passive: true });

  function rafLoop() {
    // Dot: snap to cursor
    if (dotX !== mouseX || dotY !== mouseY) {
      dotX = mouseX;
      dotY = mouseY;
      // transform keeps this on GPU — left/top triggers layout
      dot.style.transform = `translate(calc(-50% + ${dotX}px), calc(-50% + ${dotY}px))`;
      dot.style.left = '0';
      dot.style.top  = '0';
    }

    // Outline: lerp toward cursor
    outlineX += (mouseX - outlineX) * 0.15;
    outlineY += (mouseY - outlineY) * 0.15;
    outline.style.left = outlineX + 'px';
    outline.style.top  = outlineY + 'px';

    requestAnimationFrame(rafLoop);
  }

  // Throttled hover detection via event delegation — one listener, not N
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, input, select')) {
      outline.style.transform = 'translate(-50%, -50%) scale(1.5)';
    }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, input, select')) {
      outline.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  }, { passive: true });
})();


/* ----------------------------------------------------------------
   2. SCROLL OBSERVER
   PERFORMANCE FIX: unobserve() after adding .show so the observer
   is not tracking already-revealed elements forever. Each element
   fires exactly once and is then dropped from the observer.
---------------------------------------------------------------- */
(function initScrollObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        // Stop watching — this element will never need to hide again
        observer.unobserve(entry.target);
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
   Desktop: arrow buttons + scrollend dot sync.
   Mobile:  IG-story tap zones (left half = prev, right half = next)
            + native CSS scroll-snap momentum swiping.
   Slider conflict: touchstart on .sliderRange stops propagation
   so dragging the before/after handle never accidentally
   navigates to the next slide.
---------------------------------------------------------------- */
(function initGalleryNav() {
  const carousel   = document.querySelector('.gallery-carousel');
  const prevBtn    = document.querySelector('.nav-btn.prev');
  const nextBtn    = document.querySelector('.nav-btn.next');
  const dots       = document.querySelectorAll('.dot');
  if (!carousel) return;

  const totalSlides = carousel.querySelectorAll('.gallery-slide').length;

  /* ── Helpers ── */
  function currentIndex() {
    const w = carousel.clientWidth;
    return w ? Math.min(Math.round(carousel.scrollLeft / w), totalSlides - 1) : 0;
  }

  function goTo(index) {
    const clamped = Math.max(0, Math.min(index, totalSlides - 1));
    carousel.scrollTo({ left: clamped * carousel.clientWidth, behavior: 'smooth' });
  }

  function syncDots() {
    const idx = currentIndex();
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  /* ── Desktop arrow buttons ── */
  if (prevBtn) prevBtn.addEventListener('click', () => goTo(currentIndex() - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(currentIndex() + 1));

  /* ── Dot sync: scrollend (modern) or debounced scroll (fallback) ── */
  if ('onscrollend' in window) {
    carousel.addEventListener('scrollend', syncDots, { passive: true });
  } else {
    let t;
    carousel.addEventListener('scroll', () => {
      clearTimeout(t);
      t = setTimeout(syncDots, 80);
    }, { passive: true });
  }

  /* ── Mobile: IG-story tap zones ──
     Only active on coarse-pointer (touch) devices.
     Tap left 40% of the carousel viewport → prev slide.
     Tap right 40% → next slide.
     Middle 20% is a dead-zone so incidental taps don't navigate.
     We ignore taps that started on a .sliderRange (before/after handle)
     or travelled more than 8px (real swipe — let native snap handle it). ── */
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    let tapStartX = null;
    let tapStartY = null;
    let tappedOnSlider = false;

    carousel.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      tapStartX = t.clientX;
      tapStartY = t.clientY;
      tappedOnSlider = !!e.target.closest('.sliderRange');
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
      if (tappedOnSlider || tapStartX === null) return;

      const t = e.changedTouches[0];
      const dx = Math.abs(t.clientX - tapStartX);
      const dy = Math.abs(t.clientY - tapStartY);

      // If the finger moved more than 8px it was a real swipe → let snap handle it
      if (dx > 8 || dy > 8) { tapStartX = null; return; }

      // It was a tap — check which zone
      const rect    = carousel.getBoundingClientRect();
      const relX    = t.clientX - rect.left;
      const pct     = relX / rect.width;

      if (pct < 0.40) {
        goTo(currentIndex() - 1);
      } else if (pct > 0.60) {
        goTo(currentIndex() + 1);
      }
      // Middle 20% → do nothing (user may be interacting with slider handle)

      tapStartX = null;
    }, { passive: true });
  }

  /* ── Passive touch on carousel: never block native momentum scroll ── */
  carousel.addEventListener('touchmove', () => {}, { passive: true });
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
