/**
 * Measurement layer. Pushes meaningful, personal-data-free events to window.dataLayer (Google Tag Manager).
 * The plan (event names, parameters, when each fires) lives in _tools/facts/analytics.json and is checked by gate G13.
 *
 *  - no dependencies, never throws, never blocks the page
 *  - silent when the visitor sends Global Privacy Control / Do Not Track
 *  - every event carries site_language (en | pt | es)
 */
(function (w, d) {
	'use strict';

	var SECTIONS = ['intro', 'about', 'impact', 'resume', 'portfolio', 'cta', 'services', 'contact', 'footer'];
	var LANGS = { en: 1, pt: 1, es: 1 };
	var STAT = { '#role-fb-staff': 'team', '#case-finops': 'cost', '#case-migration': 'sources', '#case-unity': 'domains', '#case-cicd': 'incidents', '#case-clicksign': 'pipelines' };
	var OWL = { 'owl-slider-work': 'experience', 'owl-slider-cert': 'certifications', 'owl-slider-extra': 'talks', 'owl-slider': 'services', 'owl-slider-port': 'projects' };
	var LIMIT = { skill_hover: 15, case_view: 12, carousel_navigate: 40, js_error: 3, section_view: 12, scroll_depth: 4, nav_click: 40 };
	var ACTIVE_MS = 20000; // a visitor counts as "reading" for 20 s after the last scroll / move / key / touch

	function isLang(l) { return typeof l === 'string' && Object.prototype.hasOwnProperty.call(LANGS, l); }

	function optedOut() {
		var n = w.navigator || {};
		return n.globalPrivacyControl === true || n.doNotTrack === '1' || w.doNotTrack === '1' || n.msDoNotTrack === '1';
	}
	var optOut = optedOut() || !!w.__trackingOptOut; /* track-optout */
	var dl = w.dataLayer = w.dataLayer || [];
	var counts = {};
	/* Every parameter the plan allows (all but site_language, which every event sets). GTM data layer variables (version 2) keep the
	   last value they saw, so each event first clears the ones it does not carry; otherwise a value from the previous event leaks into the next. */
	var PARAMS = ['item', 'slide', 'location', 'method', 'state', 'link_type', 'link_domain', 'file_name', 'cv_language', 'from_language', 'to_language', 'language_source', 'browser_language', 'device_class', 'reduced_motion', 'seconds', 'percent', 'total_seconds', 'sections_seen', 'max_scroll_percent', 'message', 'file', 'via'];

	function lang() {
		return (w.PortfolioI18n && w.PortfolioI18n.get && w.PortfolioI18n.get()) || d.documentElement.getAttribute('data-lang') || 'en';
	}
	function str(v, n) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 100); }

	function track(name, params) {
		if (optOut) { return; }
		try {
			counts[name] = (counts[name] || 0) + 1;
			if (counts[name] > (LIMIT[name] || 80)) { return; }
			var p = { event: name, site_language: lang() };
			for (var k in params) {
				if (!Object.prototype.hasOwnProperty.call(params, k)) { continue; }
				var v = params[k];
				if (v === undefined || v === null || v === '') { continue; }
				p[k] = typeof v === 'number' ? Math.round(v) : str(v);
			}
			var clear = {};
			for (var i = 0; i < PARAMS.length; i++) { if (!Object.prototype.hasOwnProperty.call(p, PARAMS[i])) { clear[PARAMS[i]] = undefined; } }
			dl.push(clear); /* no "event" key: updates the data model without firing any trigger */
			dl.push(p);
		} catch (e) { /* measurement must never break the page */ }
	}

	function sectionOf(el) {
		if (el && el.closest) {
			if (el.closest('.popup-modal')) { return 'portfolio'; }
			var s = el.closest('section[id], footer, header');
			if (s) { return s.id || s.tagName.toLowerCase(); }
		}
		return 'page';
	}
	function hostOf(a) {
		try { return new URL(a.href, w.location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
	}

	/* ---- clicks --------------------------------------------------------------------------------------------- */
	function classifyLink(a) {
		var href = a.getAttribute('href') || '', loc = sectionOf(a), host = hostOf(a);
		if (/^mailto:/i.test(href)) { var path = a.getAttribute('data-contact'); track('contact_click', { method: path ? 'email_' + path : 'email', location: loc }); return; }
		if (/\.pdf($|[?#])/i.test(href)) {
			var file = href.split(/[?#]/)[0].split('/').pop();
			if (/\/cv\//i.test(href)) { /* track-cv */
				var m = file.match(/_CV_([A-Z]{2})\.pdf$/);
				track('cv_download', { file_name: file, cv_language: m ? m[1].toLowerCase() : 'pt', location: loc });
			} else {
				track('certificate_open', { file_name: file, location: loc });
			}
			return;
		}
		if (host === 'linkedin.com') { track('contact_click', { method: 'linkedin', location: loc }); return; }
		if (host === 'github.com') { track('contact_click', { method: 'github', location: loc }); return; }
		if (/^https?:/i.test(a.href) && (host !== w.location.hostname || a.closest('.popup-modal'))) {
			var type = 'other';
			if (/credly\.com$/.test(host)) { type = 'certificate_verify'; }
			else if (/(^|\.)(clicksign\.com|ada\.tech)$/.test(host)) { type = 'company'; }
			else if (/thedevconf\.com$/.test(host)) { type = 'event'; }
			else if (/(youtube\.com|youtu\.be)$/.test(host)) { type = 'episode'; }
			else if (/github\.io$/.test(host)) { type = 'project'; }
			track('outbound_click', { link_type: type, link_domain: host, location: loc });
		}
	}

	function onClick(e) {
		var t = e.target, el;
		if (!t || !t.closest) { return; }
		if ((el = t.closest('.menu-toggle'))) { track('menu_toggle', { state: el.getAttribute('aria-expanded') === 'true' ? 'close' : 'open' }); return; }
		if ((el = t.closest('.stat-link'))) { carouselMuteUntil = new Date().getTime() + 1200; track('impact_stat_click', { item: STAT[el.getAttribute('href')] || 'other' }); return; }
		if ((el = t.closest('.glance-link'))) { carouselMuteUntil = new Date().getTime() + 1200; track('nav_click', { item: (el.getAttribute('href') || '').replace('#', ''), via: 'glance' }); return; }
		if ((el = t.closest('.case-filter'))) { track('case_filter', { item: el.getAttribute('data-filter') }); return; }
		if ((el = t.closest('.item-wrap a'))) { track('project_open', { item: (el.getAttribute('href') || '').replace('#', '') }); return; }
		if ((el = t.closest('.train-details summary, .early-projects summary'))) { track('training_toggle', { item: el.parentNode.classList.contains('early-projects') ? 'early_projects' : 'courses', state: el.parentNode.open ? 'close' : 'open' }); return; }
		if ((el = t.closest('[data-fold-toggle]'))) { track('content_toggle', { item: el.getAttribute('data-fold-item'), state: el.getAttribute('aria-expanded') === 'true' ? 'close' : 'open' }); return; }
		if (t.closest('#go-top')) { track('back_to_top', {}); return; }
		if ((el = t.closest('a.brand, #main-nav-wrap a'))) {
			var brand = el.classList.contains('brand'), toggle = d.querySelector('.menu-toggle');
			track('nav_click', { item: brand ? 'top' : (el.getAttribute('href') || '').replace('#', ''), via: brand ? 'brand' : (toggle && toggle.offsetParent !== null ? 'dropdown' : 'bar') });
			return;
		}
		if ((el = t.closest('a[href]'))) { classifyLink(el); }
	}

	/* ---- language ------------------------------------------------------------------------------------------- */
	var lastInput = 'pointer', lastLangChange = 0;
	function onLanguage(e) {
		var det = (e && e.detail) || {};
		lastLangChange = new Date().getTime();
		if (det.user && det.previous && det.previous !== det.lang) {
			track('language_toggle', { from_language: det.previous, to_language: det.lang, method: lastInput === 'key' ? 'keyboard' : 'pointer' });
		}
	}

	function siteContext() {
		var q = null, saved = null;
		try { q = new URLSearchParams(w.location.search).get('lang'); } catch (e) { /* old browser */ }
		try { saved = w.localStorage.getItem('lang'); } catch (e) { /* blocked storage */ }
		var bl = String((w.navigator && w.navigator.language) || '').slice(0, 2).toLowerCase();
		var width = w.innerWidth || d.documentElement.clientWidth;
		track('site_context', {
			language_source: isLang(q) || isLang(d.documentElement.getAttribute('data-page-lang')) ? 'url' : (isLang(saved) ? 'saved' : 'default'), // /pt/ and /es/ count as chosen by the address
			browser_language: isLang(bl) ? bl : 'other',
			device_class: width < 768 ? 'mobile' : (width < 1180 ? 'tablet' : 'desktop'),
			reduced_motion: w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'yes' : 'no'
		});
	}

	/* ---- reading: scroll depth, time per section, case cards ------------------------------------------------- */
	var lastActive = new Date().getTime(), dwell = {}, seen = {}, activeSecs = 0, streakId = null, streak = 0, maxScroll = 0, depthDone = {};

	function currentSection() {
		var y = (w.innerHeight || d.documentElement.clientHeight) / 2;
		for (var i = 0; i < SECTIONS.length; i++) {
			var el = SECTIONS[i] === 'footer' ? d.querySelector('footer') : d.getElementById(SECTIONS[i]);
			if (!el) { continue; }
			var r = el.getBoundingClientRect();
			if (r.top <= y && r.bottom > y) { return SECTIONS[i]; }
		}
		return null;
	}

	function tick() {
		if (d.visibilityState !== 'visible' || new Date().getTime() - lastActive > ACTIVE_MS) { streakId = null; return; }
		activeSecs++;
		var s = currentSection();
		if (!s) { return; }
		dwell[s] = (dwell[s] || 0) + 1;
		if (s === streakId) { streak++; } else { streakId = s; streak = 1; }
		if (streak >= 2 && !seen[s]) { seen[s] = 1; track('section_view', { item: s }); }
	}

	function flush() {
		var any = false;
		for (var s in dwell) {
			if (Object.prototype.hasOwnProperty.call(dwell, s) && dwell[s] >= 3) { any = true; track('section_dwell', { item: s, seconds: Math.min(dwell[s], 900) }); }
		}
		if (any || activeSecs >= 3) {
			track('engagement_summary', { total_seconds: Math.min(activeSecs, 3600), sections_seen: Object.keys(seen).length, max_scroll_percent: maxScroll });
		}
		dwell = {};
		activeSecs = 0;
	}

	function onScroll() {
		var total = Math.max(d.documentElement.scrollHeight, 1);
		var pct = Math.min(100, ((w.pageYOffset || 0) + (w.innerHeight || 0)) / total * 100);
		if (pct > maxScroll) { maxScroll = pct; }
		var marks = [25, 50, 75, 100];
		for (var i = 0; i < marks.length; i++) {
			if (!depthDone[marks[i]] && pct >= (marks[i] === 100 ? 98 : marks[i])) { depthDone[marks[i]] = 1; track('scroll_depth', { percent: marks[i] }); }
		}
	}

	function watchCases() {
		if (!('IntersectionObserver' in w)) { return; }
		var timers = {}, fired = {};
		var io = new w.IntersectionObserver(function (entries) {
			for (var i = 0; i < entries.length; i++) {
				var en = entries[i], id = (en.target.id || '').replace(/^case-/, '');
				if (en.isIntersecting) {
					if (!timers[id] && !fired[id]) {
						timers[id] = w.setTimeout((function (cid) { return function () { fired[cid] = 1; timers[cid] = null; track('case_view', { item: cid }); }; })(id), 2000);
					}
				} else if (timers[id]) {
					w.clearTimeout(timers[id]);
					timers[id] = null;
				}
			}
		}, { threshold: 0.6 });
		var cards = d.querySelectorAll('.case-card');
		for (var j = 0; j < cards.length; j++) { io.observe(cards[j]); }
	}

	/* ---- skills the visitor lingers on ----------------------------------------------------------------------- */
	var hoverTimer = null, hoverEl = null, skillSeen = {};
	function skillName(li) {
		var key = li.getAttribute('data-i18n');
		return str(key && w.PortfolioI18n ? w.PortfolioI18n.t(key, 'en') : li.textContent, 60);
	}
	function onOver(e) {
		var li = e.target && e.target.closest ? e.target.closest('.tags li') : null;
		if (!li || li === hoverEl) { return; }
		hoverEl = li;
		w.clearTimeout(hoverTimer);
		hoverTimer = w.setTimeout(function () {
			var name = skillName(li);
			if (name && !skillSeen[name]) { skillSeen[name] = 1; track('skill_hover', { item: name }); }
		}, 500);
	}
	function onOut(e) {
		var li = e.target && e.target.closest ? e.target.closest('.tags li') : null;
		if (li && li === hoverEl) { hoverEl = null; w.clearTimeout(hoverTimer); }
	}

	/* ---- carousels (called by Owl's afterMove in main.js) ---------------------------------------------------- */
	var ready = false, carouselMuteUntil = 0;
	function carousel(id, index, roleId) {
		var now = new Date().getTime();
		if (!ready || now - lastLangChange < 800 || now < carouselMuteUntil) { return; } // ignore the re-layout after a language switch and slides the page moved by itself /* mute-carousel */
		track('carousel_navigate', { item: OWL[id] || id, slide: roleId || String(index + 1) });
	}

	/* ---- start ------------------------------------------------------------------------------------------------ */
	function init() {
		if (optOut) { return; }
		var mark = function () { lastActive = new Date().getTime(); };
		['scroll', 'mousemove', 'keydown', 'touchstart', 'pointerdown', 'wheel'].forEach(function (ev) { w.addEventListener(ev, mark, { passive: true, capture: true }); });
		w.addEventListener('keydown', function () { lastInput = 'key'; }, true);
		w.addEventListener('pointerdown', function () { lastInput = 'pointer'; }, true);
		d.addEventListener('click', onClick, true);
		d.addEventListener('i18n:change', onLanguage);
		d.addEventListener('mouseover', onOver, true);
		d.addEventListener('mouseout', onOut, true);
		var scrollTimer = null;
		w.addEventListener('scroll', function () { if (!scrollTimer) { scrollTimer = w.setTimeout(function () { scrollTimer = null; onScroll(); }, 200); } }, { passive: true });
		w.setInterval(tick, 1000);
		d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') { flush(); } });
		w.addEventListener('pagehide', flush);
		w.addEventListener('beforeprint', function () { track('page_print', {}); });
		w.addEventListener('error', function (e) {
			if (!e || !e.filename || e.filename.indexOf(w.location.origin) !== 0) { return; } // only this site's own scripts
			track('js_error', { message: e.message, file: String(e.filename).split('/').pop() + ':' + e.lineno });
		});
		w.addEventListener('load', function () { w.setTimeout(function () { ready = true; }, 600); });
		watchCases();
		siteContext();
	}

	w.PortfolioAnalytics = { enabled: !optOut, track: track, carousel: carousel };
	try { init(); } catch (e) { /* measurement must never break the page */ }
})(window, document);
