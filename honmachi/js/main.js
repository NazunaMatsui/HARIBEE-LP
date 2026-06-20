/* ===================================================
   HARIBEE 本町店 LP - メインJavaScript
   =================================================== */

'use strict';

/* ===== INTERSECTION OBSERVER - スクロールアニメーション ===== */
const animateElements = document.querySelectorAll(
  '.animate-fadeup, .animate-slideup, .animate-fadein, .animate-slidein'
);

const observerOptions = {
  /* 0.15 + 下マージンだとモバイルで発火し損ねることがあるため緩める */
  threshold: 0,
  rootMargin: '0px 0px 0px 0px'
};

const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      scrollObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

animateElements.forEach(el => {
  /* FV 内は表示タイミングを load 後に段階表示するため、ここでは監視しない */
  if (el.closest('.fv')) {
    return;
  }
  /* 予約CTA（#reservation）はセクション単位で段階表示するため除外 */
  if (el.closest('#reservation')) {
    return;
  }
  scrollObserver.observe(el);
});

/* IntersectionObserver が欠落する端末向け：表示域に入った要素へ is-visible を補完 */
function unveilAnimatedElementsIfInView() {
  document.querySelectorAll(
    '.animate-fadeup, .animate-slideup, .animate-fadein, .animate-slidein'
  ).forEach((el) => {
    if (el.closest('.fv')) return;
    if (el.closest('#reservation')) return;
    if (el.classList.contains('is-visible')) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    if (rect.top < vh && rect.bottom > 0 && rect.left < vw && rect.right > 0) {
      el.classList.add('is-visible');
      try {
        scrollObserver.unobserve(el);
      } catch (e) {
        /* 未 observe の場合は無視 */
      }
    }
  });
}

let unveilRaf = 0;
function scheduleUnveilAnimated() {
  if (unveilRaf) return;
  unveilRaf = requestAnimationFrame(() => {
    unveilRaf = 0;
    unveilAnimatedElementsIfInView();
  });
}

window.addEventListener('scroll', scheduleUnveilAnimated, { passive: true });
window.addEventListener('resize', scheduleUnveilAnimated);

/* ===== 予約CTA（#reservation）：見出しPNG → 価格 → ボタンの段階表示 ===== */
function initCtaStaggerReveal() {
  const section = document.getElementById('reservation');
  if (!section) return;

  const selectors = ['.cta-heading-wrap', '.cta-price', '.cta-buttons'];

  const runStagger = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const baseDelay = 80;
    const step = 200;
    selectors.forEach((sel, i) => {
      const el = section.querySelector(sel);
      if (!el) return;
      if (reduceMotion) {
        el.classList.add('is-visible');
      } else {
        setTimeout(() => {
          el.classList.add('is-visible');
        }, baseDelay + i * step);
      }
    });
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    runStagger();
    return;
  }

  if (typeof IntersectionObserver === 'undefined') {
    runStagger();
    return;
  }

  let triggered = false;

  const fireIfNeeded = () => {
    if (triggered) return;
    triggered = true;
    runStagger();
    try {
      io.unobserve(section);
    } catch (e) {
      /* ignore */
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || triggered) return;
        fireIfNeeded();
      });
    },
    /* 高い min-height のセクションは 12% 未満の交差しか出ず発火しないことがあるため 0 に近い閾値で検知 */
    { threshold: 0, rootMargin: '0px 0px 0px 0px' }
  );

  io.observe(section);

  /* 既にビューポート内にある場合、一部ブラウザで初回コールバックが遅延／欠落することがあるため保険 */
  const checkAlreadyVisible = () => {
    if (triggered) return;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom > 0 && rect.top < vh) {
      fireIfNeeded();
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(checkAlreadyVisible);
  });

  /* 初回は画面下にあり交差しない場合があるため、スクロールで再判定 */
  const onScrollReservation = () => {
    if (triggered) {
      window.removeEventListener('scroll', onScrollReservation);
      return;
    }
    checkAlreadyVisible();
  };
  window.addEventListener('scroll', onScrollReservation, { passive: true });
}

initCtaStaggerReveal();

/* ===== 施術の仕組み：動画は表示域に入ったら自動再生（ミュート・コントロールなし） ===== */
function initMechIntroVideoScrollPlay() {
  const video = document.querySelector('.mech-intro-video');
  const wrap = document.querySelector('.mech-intro-video-wrap');
  if (!video) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    video.controls = true;
    video.removeAttribute('muted');
    return;
  }

  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.playsInline = true;

  let shouldPlay = false;

  const tryPlay = () => {
    if (!shouldPlay) return;
    const p = video.play();
    if (p !== undefined && typeof p.then === 'function') {
      p.catch(() => {
        /* 未デコード・未ロード時は canplay で再試行 */
      });
    }
  };

  const tryPause = () => {
    try {
      video.pause();
    } catch (e) {
      /* ignore */
    }
  };

  const setPlaying = (play) => {
    shouldPlay = play;
    if (play) {
      tryPlay();
    } else {
      tryPause();
    }
  };

  video.addEventListener('canplay', () => {
    if (shouldPlay) tryPlay();
  });

  video.addEventListener('error', () => {
    video.controls = true;
    video.removeAttribute('muted');
  });

  const observeTarget = wrap || video;

  if (typeof IntersectionObserver === 'undefined') {
    setPlaying(true);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        setPlaying(entry.isIntersecting);
      });
    },
    {
      /* 下端ギリギリでも検知しやすくする（以前の -8% は未交差になりやすい） */
      threshold: 0.12,
      rootMargin: '0px'
    }
  );

  io.observe(observeTarget);

  const checkAlreadyVisible = () => {
    const el = observeTarget;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.bottom > 0 && rect.top < vh) {
      setPlaying(true);
    }
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(checkAlreadyVisible);
  });
}

initMechIntroVideoScrollPlay();

/* ===== HEADER - スクロールで影を付ける ===== */
const header = document.getElementById('header');

function handleHeaderScroll() {
  if (!header) return;
  if (window.scrollY > 80) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', handleHeaderScroll, { passive: true });

/* ===== FLOATING CTA - スクロールで表示（メインCTA表示中は非表示） ===== */
const floatingCta = document.getElementById('floatingCta');
const fvSection = document.querySelector('.fv');

/** 要素の一部でもビューポート内にあれば true */
function isPartiallyVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return r.top < vh && r.bottom > 0 && r.left < (window.innerWidth || 0) && r.right > 0;
}

/** ページ内の予約CTA（ヘッダー固定・フローティング以外）が見えていれば true */
function isAnyInlineCtaVisible() {
  const anchors = document.querySelectorAll('a.cta-img');
  for (let i = 0; i < anchors.length; i += 1) {
    const a = anchors[i];
    if (floatingCta && floatingCta.contains(a)) continue;
    if (a.closest('#header')) continue;
    if (isPartiallyVisible(a)) return true;
  }
  return false;
}

let floatingCtaRaf = 0;
function handleFloatingCta() {
  if (!floatingCta || !fvSection) return;
  if (floatingCtaRaf) return;
  floatingCtaRaf = requestAnimationFrame(() => {
    floatingCtaRaf = 0;
    const fvBottom = fvSection.getBoundingClientRect().bottom;
    const shouldShow = fvBottom < 0 && !isAnyInlineCtaVisible();

    if (shouldShow) {
      if (!floatingCta.classList.contains('show')) {
        floatingCta.classList.add('show');
      }
    } else if (floatingCta.classList.contains('show')) {
      floatingCta.classList.remove('show');
    }
  });
}

window.addEventListener('scroll', handleFloatingCta, { passive: true });
window.addEventListener('resize', handleFloatingCta, { passive: true });
handleFloatingCta();

/* ===== FAQ - アコーディオン ===== */
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  const answer = item.querySelector('.faq-answer');
  if (!question || !answer) return;

  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('is-open');

    faqItems.forEach(otherItem => {
      const otherQuestion = otherItem.querySelector('.faq-question');
      const otherAnswer = otherItem.querySelector('.faq-answer');
      if (!otherQuestion || !otherAnswer) return;
      otherItem.classList.remove('is-open');
      otherQuestion.setAttribute('aria-expanded', 'false');
      otherAnswer.setAttribute('aria-hidden', 'true');
    });

    if (!isOpen) {
      item.classList.add('is-open');
      question.setAttribute('aria-expanded', 'true');
      answer.setAttribute('aria-hidden', 'false');
    }
  });
});

/* ===== 価格比較グラフ - アニメーション ===== */
const compareBars = document.querySelectorAll('.compare-bar');
let barAnimated = false;

const barObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !barAnimated) {
      barAnimated = true;
      animateBars();
    }
  });
}, { threshold: 0.5 });

const compareChart = document.querySelector('.compare-chart');
if (compareChart) {
  barObserver.observe(compareChart);
}

function animateBars() {
  const otherBar = document.querySelector('.compare-item.other .compare-bar');
  const haribeeBar = document.querySelector('.compare-item.haribee .compare-bar');
  const wrap = document.querySelector('.compare-item.other .compare-bar-wrap');

  if (otherBar && haribeeBar && wrap) {
    const maxH = wrap.offsetHeight;
    const otherPrice = 26000;
    const haribeePrice = 8800;
    const shortH = Math.round(maxH * (haribeePrice / otherPrice));
    otherBar.style.transition = 'height 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
    haribeeBar.style.transition = 'height 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.3s';

    setTimeout(() => {
      otherBar.style.height = `${maxH}px`;
      haribeeBar.style.height = `${shortH}px`;
    }, 100);
  }
}

/* ===== スムーズスクロール（ナビリンク） ===== */
const navLinks = document.querySelectorAll('a[href^="#"]');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    const targetId = link.getAttribute('href');
    if (targetId === '#') return;

    const targetEl = document.querySelector(targetId);
    if (targetEl) {
      e.preventDefault();
      const targetPos = targetEl.getBoundingClientRect().top + window.scrollY - 16;

      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      });
    }
  });
});

/* ===== FV：ふわっと段階表示（ローダー退場と同タイミングで視認できるよう同期） ===== */
let fvRevealInitialized = false;

function initFvRevealAnimations() {
  if (fvRevealInitialized) return;
  fvRevealInitialized = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 表示順：サイドコピー → アクセス帯 → 3丸 → 本格バナー → CTA（従来どおり） */
  const fvRevealSelectors = [
    '.fv-side-copy-wrap.fv-float-reveal',
    '.fv-access-strip-wrap.fv-float-reveal',
    '.fv-feature-reveal--badges',
    '.fv-feature-reveal--lead',
    '.fv-cta.fv-float-reveal'
  ];

  if (reduceMotion) {
    fvRevealSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.classList.add('is-visible');
    });
    return;
  }

  const baseDelay = 80;
  const step = 200;
  fvRevealSelectors.forEach((sel, i) => {
    const el = document.querySelector(sel);
    if (!el) return;
    setTimeout(() => {
      el.classList.add('is-visible');
    }, baseDelay + i * step);
  });
}

/* ===== 数字カウントアップアニメーション（価格表示） ===== */
function animateCountUp(element, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.floor(easeOut * (end - start) + start).toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

/* ===== お悩みチェックリスト：アコーディオン ===== */
function initWorryAccordion() {
  const root = document.querySelector('.worries-grid--checklist');
  if (!root) return;

  const accordions = root.querySelectorAll('.worry-card--accordion');
  if (!accordions.length) return;

  accordions.forEach((card) => {
    const btn = card.querySelector('.worry-card__trigger');
    const panel = card.querySelector('.worry-card__panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const wasOpen = card.classList.contains('is-open');

      accordions.forEach((c) => {
        c.classList.remove('is-open');
        const b = c.querySelector('.worry-card__trigger');
        const p = c.querySelector('.worry-card__panel');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (p) p.setAttribute('aria-hidden', 'true');
      });

      if (!wasOpen) {
        card.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  });
}

initWorryAccordion();

/* ===== カードホバーエフェクト ===== */
const cards = document.querySelectorAll('.worry-card, .voice-card, .reason-item');

cards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.willChange = 'transform';
  });

  card.addEventListener('mouseleave', () => {
    card.style.willChange = 'auto';
  });
});

/* ===== ページトップボタン表示 ===== */
const pageTopBtn = document.createElement('button');
pageTopBtn.id = 'pageTopBtn';
pageTopBtn.className = 'page-top-btn';
pageTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
pageTopBtn.setAttribute('aria-label', 'ページトップへ戻る');
pageTopBtn.type = 'button';

document.body.appendChild(pageTopBtn);

pageTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    pageTopBtn.style.opacity = '1';
    pageTopBtn.style.transform = 'translateY(0)';
  } else {
    pageTopBtn.style.opacity = '0';
    pageTopBtn.style.transform = 'translateY(20px)';
  }
}, { passive: true });

/* ===== ローディングアニメーション ===== */
const loader = document.createElement('div');
loader.id = 'pageLoader';
loader.innerHTML = `
  <div class="loader-inner">
    <div class="loader-logo">HARIBEE</div>
    <div class="loader-bar"><div class="loader-progress"></div></div>
  </div>
`;
loader.style.cssText = `
  position: fixed;
  inset: 0;
  background: #fdf9f5;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity 0.35s ease, visibility 0.35s ease;
`;

const loaderStyle = document.createElement('style');
loaderStyle.textContent = `
  .loader-inner {
    text-align: center;
  }
  .loader-logo {
    font-family: 'Noto Serif JP', serif;
    font-size: 2rem;
    letter-spacing: 0.3em;
    color: #c9956a;
    margin-bottom: 24px;
    animation: fadeInLogo 0.32s ease forwards;
  }
  .loader-bar {
    width: 160px;
    height: 2px;
    background: #e8c9a0;
    border-radius: 2px;
    overflow: hidden;
    margin: 0 auto;
  }
  .loader-progress {
    height: 100%;
    background: linear-gradient(90deg, #c9956a, #a67850);
    width: 0%;
    animation: loadProgress 0.42s ease-out forwards;
    border-radius: 2px;
  }
  @keyframes fadeInLogo {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes loadProgress {
    0% { width: 0%; }
    100% { width: 100%; }
  }
`;
document.head.appendChild(loaderStyle);
document.body.insertBefore(loader, document.body.firstChild);

/* 以前は window.load（全画像・フォント完了）待ち＋1.4s 固定待ちで初回が非常に長かった。
   DOM 構築後すぐ退場し、下層画像は lazy 読み込みに任せる。 */
const LOADER_MIN_MS = 200;
let loaderDismissed = false;

function dismissPageLoader() {
  if (loaderDismissed) return;
  const el = document.getElementById('pageLoader');
  if (!el) {
    loaderDismissed = true;
    return;
  }
  loaderDismissed = true;
  initFvRevealAnimations();
  el.style.opacity = '0';
  el.style.visibility = 'hidden';
  window.setTimeout(() => {
    el.remove();
  }, 360);
  scheduleUnveilAnimated();
  window.setTimeout(scheduleUnveilAnimated, 120);
}

function scheduleLoaderExitAndFvReveal() {
  window.setTimeout(dismissPageLoader, LOADER_MIN_MS);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleLoaderExitAndFvReveal, { once: true });
} else {
  scheduleLoaderExitAndFvReveal();
}

/* ローダーが何らかの理由で残り続ける場合の上限 （保険） */
window.setTimeout(dismissPageLoader, 4000);

/* FV 段階表示のフォールバック（極端に遅い端末） */
window.setTimeout(() => {
  if (!fvRevealInitialized) {
    initFvRevealAnimations();
  }
}, 7000);
