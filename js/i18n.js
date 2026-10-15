/**
 * Trilingual engine (EN default, PT-BR, ES). No dependencies.
 *
 * Dictionaries : js/i18n/{en,pt,es}.js  -> window.I18N.en / .pt / .es
 * Markup       : data-i18n="key"            -> textContent
 *                data-i18n-html="key"       -> innerHTML (author-controlled strings only)
 *                data-i18n-attr="a:key;b:key" -> setAttribute(a, t(key))
 *                data-date="2025-07" [data-date-end="2026-06|present"] -> localised date / range
 *                data-href-en / data-href-pt / data-href-es -> href per language (CV downloads)
 * Language     : ?lang=en|pt|es  ->  the page's own language (static pages /pt/ and /es/ carry <html data-page-lang>)  ->  saved choice (localStorage)  ->  EN
 * Event        : 'i18n:change' dispatched on document after every switch (detail: lang, previous, user = chosen by the visitor)
 */
(function (w, d) {
	'use strict';

	var DEFAULT = 'en';
	var HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };
	var STORAGE_KEY = 'lang';
	var MONTHS = {
		en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
		es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
	};
	var PRESENT = { en: 'Present', pt: 'Atual', es: 'Actualidad' };
	var DICT = w.I18N || {};
	var current = null;

	function isLang(l) { return typeof l === 'string' && Object.prototype.hasOwnProperty.call(HTML_LANG, l); }

	function readStore() {
		try { return w.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
	}
	function writeStore(l) {
		try { w.localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* private mode / blocked storage */ }
	}
	function fromQuery() {
		try {
			var q = new URLSearchParams(w.location.search).get('lang');
			return isLang(q) ? q : null;
		} catch (e) { return null; }
	}
	// the static language pages (/pt/, /es/) already hold their text: the address decides, a saved choice does not override it
	function pageLang() {
		var p = d.documentElement.getAttribute('data-page-lang');
		return isLang(p) ? p : null;
	}
	function resolve() {
		var s = readStore();
		return fromQuery() || pageLang() || (isLang(s) ? s : null) || DEFAULT;
	}

	function t(key, lang) {
		lang = lang || current || DEFAULT;
		var v = DICT[lang] && DICT[lang][key];
		if (typeof v !== 'string') {
			v = DICT[DEFAULT] && DICT[DEFAULT][key];
			if (lang !== DEFAULT && w.console) { w.console.warn('[i18n] missing "' + key + '" for ' + lang); }
		}
		return typeof v === 'string' ? v : key;
	}

	function fmtDate(iso, lang) {
		if (iso === 'present') { return PRESENT[lang]; }
		var p = iso.split('-');
		if (p.length === 1) { return p[0]; }
		var m = MONTHS[lang][parseInt(p[1], 10) - 1];
		return lang === 'pt' ? m + '/' + p[0] : m + ' ' + p[0];
	}
	function fmtRange(start, end, lang) {
		var s = fmtDate(start, lang);
		return end ? s + ' – ' + fmtDate(end, lang) : s;
	}

	function each(root, selector, fn) {
		var list = root.querySelectorAll(selector);
		for (var i = 0; i < list.length; i++) { fn(list[i]); }
	}

	function apply(root, lang) {
		each(root, '[data-i18n]', function (el) { el.textContent = t(el.getAttribute('data-i18n'), lang); });
		each(root, '[data-i18n-html]', function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html'), lang); });
		each(root, '[data-i18n-attr]', function (el) {
			el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
				var i = pair.indexOf(':');
				if (i > 0) { el.setAttribute(pair.slice(0, i).trim(), t(pair.slice(i + 1).trim(), lang)); }
			});
		});
		each(root, '[data-date]', function (el) {
			el.textContent = fmtRange(el.getAttribute('data-date'), el.getAttribute('data-date-end'), lang);
		});
		each(root, '[data-href-' + lang + ']', function (el) { el.setAttribute('href', el.getAttribute('data-href-' + lang)); });
	}

	function syncUrl(lang) {
		try {
			var u = new URL(w.location.href);
			if (lang === pageLang()) { u.searchParams.delete('lang'); } else { u.searchParams.set('lang', lang); } // /pt/ stays clean in PT, /pt/?lang=en in EN
			// native History method on purpose: GTM / gtag wrap history.replaceState and would count this ?lang= tweak as a NEW page view (a duplicate)
			w.History.prototype.replaceState.call(w.history, null, '', u.pathname + u.search + u.hash); /* native-history */
		} catch (e) { /* file:// or sandboxed frames */ }
	}

	function updateSwitch(lang) {
		each(d, '.lang-btn', function (b) {
			b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
		});
	}

	function setLang(lang, opts) {
		opts = opts || {};
		if (!isLang(lang)) { lang = DEFAULT; }
		var changed = lang !== current;
		var previous = current;
		current = lang;

		d.documentElement.setAttribute('lang', HTML_LANG[lang]);
		d.documentElement.setAttribute('data-lang', lang);
		apply(d, lang);
		updateSwitch(lang);

		if (opts.persist) { writeStore(lang); syncUrl(lang); }
		if (opts.announce && changed) {
			var live = d.getElementById('i18n-live');
			if (live) { live.textContent = t('lang.announce', lang); }
		}
		try {
			d.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang, previous: previous, user: !!(opts.announce && changed) } }));
		} catch (e) { /* very old browsers */ }
	}

	d.addEventListener('click', function (e) {
		var btn = e.target && e.target.closest ? e.target.closest('.lang-btn') : null;
		if (btn) { setLang(btn.getAttribute('data-lang'), { persist: true, announce: true }); }
	});

	w.PortfolioI18n = {
		get: function () { return current; },
		set: function (l) { setLang(l, { persist: true, announce: true }); },
		t: t,
		refresh: function (root) { apply(root || d, current || DEFAULT); },
		formatRange: fmtRange
	};

	setLang(resolve(), { persist: false });
})(window, document);
