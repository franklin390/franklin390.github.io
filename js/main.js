/**
 * ===================================================================
 * main js
 *
 * -------------------------------------------------------------------
 */

(function($) {

	"use strict";

	var prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

	/*---------------------------------------------------- */
	/* Preloader
	------------------------------------------------------ */
	// The cover leaves as soon as the page has loaded (one 0.3 s fade; the old two-step fade added about 1.5 s on top of the load),
	// and never later than 4 s after this script runs, so a slow image or font cannot keep the page hidden.
	var preloaderGone = false;
	function hidePreloader() {
		if (preloaderGone) { return; }
		preloaderGone = true;
		$("#preloader").fadeOut(300);
	}
	$(window).on('load', hidePreloader);
	setTimeout(hidePreloader, 4000);


	/*---------------------------------------------------- */
	/* FitText Settings
	------------------------------------------------------ */
	setTimeout(function() {

		$('#intro h1').fitText(1, { minFontSize: '42px', maxFontSize: '84px' });

	}, 100);


	/*---------------------------------------------------- */
	/* FitVids
	------------------------------------------------------ */
	$(".fluid-video-wrapper").fitVids();


	/*---------------------------------------------------- */
	/* Owl Carousel Portfolio (earlier projects)
	------------------------------------------------------ */
	/* analytics: Owl calls afterMove only when the slide really changes */
	function owlMoved() {
		if (!window.PortfolioAnalytics) { return; }
		try {
			var $it = this.$elem.find('.owl-item').eq(this.currentItem);
			window.PortfolioAnalytics.carousel(this.$elem.attr('id'), this.currentItem, $it.find('[id^="role-"]').attr('id'));
		} catch (e) { /* measurement must never break the carousel */ }
	}

	var ARROWS = [
		'<i class="fa-solid fa-chevron-left" aria-hidden="true"></i><span class="sr-only" data-i18n="carousel.prev"></span>',
		'<i class="fa-solid fa-chevron-right" aria-hidden="true"></i><span class="sr-only" data-i18n="carousel.next"></span>'
	];

	/*---------------------------------------------------- */
	/* Decorative background of "Where I can help": fetched when the section gets close
	   (it weighs 196 KB and sits far below the first screen)
	------------------------------------------------------ */
	(function () {
		var section = document.getElementById('services');
		if (!section) { return; }
		function showBackground() { section.classList.add('bg-ready'); }
		if ('IntersectionObserver' in window) {
			var io = new IntersectionObserver(function (entries) {
				if (entries[0].isIntersecting) { showBackground(); io.disconnect(); }
			}, { rootMargin: '900px 0px' });
			io.observe(section);
		} else {
			showBackground();
		}
	})();


	/* Owl Carousels: experience, education, talks (one slide per item), certifications and services */
	$("#owl-slider-work, #owl-slider-academy, #owl-slider-extra").owlCarousel({
		autoHeight: true,
		navigation: true,
		navigationText: ARROWS,
		afterMove: owlMoved,
		pagination: true,
		itemsCustom : [[0, 1], [1500, 1]]
	});

	$("#owl-slider-cert").owlCarousel({
		navigation: true,
		navigationText: ARROWS,
		afterMove: owlMoved,
		pagination: true,
		itemsCustom : [[0, 1], [700, 2], [1000, 3]]
	});

	$("#owl-slider").owlCarousel({
		navigation: true,
		navigationText: ARROWS,
		afterMove: owlMoved,
		pagination: true,
		itemsCustom : [[0, 1], [700, 2], [960, 3]]
	});

	$("#owl-slider-port").owlCarousel({
		navigation: true,
		navigationText: ARROWS,
		afterMove: owlMoved,
		pagination: true,
		itemsCustom : [
			[0, 1],
			[800, 2],
			[1350, 3]
		]
	});


	/* Owl renders the arrows as <div>s: give them button semantics, keyboard support and translated labels */
	function makeArrowsAccessible() {
		$('.owl-carousel .owl-prev, .owl-carousel .owl-next').attr({ role: 'button', tabindex: 0 });
		if (window.PortfolioI18n) { window.PortfolioI18n.refresh(document); }
	}
	makeArrowsAccessible();
	$(document).on('keydown', '.owl-prev, .owl-next', function (e) {
		// Owl binds the arrows to mousedown/touchstart (not click), so call its API directly
		if (e.which === 13 || e.which === 32) {
			e.preventDefault();
			var owl = $(this).closest('.owl-carousel').data('owlCarousel');
			if (owl) { if ($(this).hasClass('owl-prev')) { owl.prev(); } else { owl.next(); } }
		}
	});

	/* Certification cards: same height for every card (no clipping: the tallest card sets the size) */
	function equalizeCertCards() {
		var $cards = $('#owl-slider-cert .cert-card');
		$cards.css('min-height', '');
		var tallest = 0;
		$cards.each(function () { tallest = Math.max(tallest, $(this).outerHeight()); });
		if (tallest) { $cards.css('min-height', tallest + 'px'); }
	}
	var equalizeTimer;
	function scheduleEqualize() { clearTimeout(equalizeTimer); equalizeTimer = setTimeout(equalizeCertCards, 150); }
	equalizeCertCards();
	$(window).on('load resize', scheduleEqualize);
	$(document).on('i18n:change', scheduleEqualize);

	/* The carousels are measured when this script runs, before the web fonts are in (on a slow phone they can arrive much later):
	   measure again once they have loaded, so the heights never depend on download timing. */
	var fontsTimer;
	function afterFonts() {
		clearTimeout(fontsTimer);
		fontsTimer = setTimeout(function () {
			$('.owl-carousel').each(function () {
				var owl = $(this).data('owlCarousel');
				if (owl && owl.options.autoHeight && typeof owl.autoHeight === 'function') { owl.autoHeight(); }
			});
			equalizeCertCards();
			if (window.Waypoint) { window.Waypoint.refreshAll(); }
		}, 60);
	}
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(afterFonts);
		if (document.fonts.addEventListener) { document.fonts.addEventListener('loadingdone', afterFonts); }
	}

	/*----------------------------------------------------- */
	/* Case-study filters (cards stay in the HTML; filtering only hides them)
	------------------------------------------------------- */
	var $caseFilters = $('.case-filter'),
	    $caseCards = $('.case-card'),
	    caseFilter = 'all',
	    caseInteracted = false;

	function renderCaseStatus() {
		if (!caseInteracted || !window.PortfolioI18n) { return; }
		var shown = $caseCards.not('.is-filtered-out').length;
		$('#case-status').text(window.PortfolioI18n.t('work.filter.showing').replace('{n}', shown).replace('{total}', $caseCards.length));
	}

	function applyCaseFilter(filter) {
		caseFilter = filter;
		// keep the filter bar where it is on screen: hiding cards shrinks the page and browsers would otherwise jump
		var filtersEl = $('.case-filters')[0];
		var topBefore = filtersEl ? filtersEl.getBoundingClientRect().top : 0;
		$caseCards.each(function () {
			var show = filter === 'all' || $(this).attr('data-cat') === filter;
			$(this).toggleClass('is-filtered-out', !show);
			if (show && !prefersReducedMotion) {
				this.classList.remove('is-entering');
				void this.offsetWidth; // restart the CSS animation
				this.classList.add('is-entering');
			}
		});
		$caseFilters.each(function () {
			$(this).attr('aria-pressed', $(this).attr('data-filter') === filter ? 'true' : 'false');
		});
		renderCaseStatus();
		if (filtersEl) {
			var shift = filtersEl.getBoundingClientRect().top - topBefore;
			if (Math.abs(shift) > 1) { window.scrollBy(0, shift); }
		}
		if (window.Waypoint) { window.Waypoint.refreshAll(); }
	}

	$caseFilters.on('click', function () {
		caseInteracted = true;
		applyCaseFilter($(this).attr('data-filter'));
	});
	$(document).on('i18n:change', renderCaseStatus);

	/*----------------------------------------------------- */
	/* Impact counters (data-count + optional data-prefix / data-suffix)
	------------------------------------------------------- */
	var statSection = $("#impact"),
	    stats = $(".stat-count");

	statSection.waypoint({

		handler: function(direction) {

			if (direction === "down" && !prefersReducedMotion) {

				stats.each(function () {
					var $this = $(this),
					    target = parseInt($this.attr('data-count'), 10),
					    prefix = $this.attr('data-prefix') || '',
					    suffix = $this.attr('data-suffix') || '';

					$({ Counter: 0 }).animate({ Counter: target }, {
						duration: 2500,
						easing: 'swing',
						step: function (curValue) {
							$this.text(prefix + Math.ceil(curValue) + suffix);
						},
						complete: function () {
							$this.text(prefix + target + suffix);
						}
					});
				});

			}

			// trigger once only
			this.destroy();

		},

		offset: "90%"

	});


	/*----------------------------------------------------*/
	/*	Modal Popup
	------------------------------------------------------*/
	$('.item-wrap a').magnificPopup({

		type:'inline',
		fixedContentPos: false,
		removalDelay: 300,
		showCloseBtn: false,
		mainClass: 'mfp-fade'

	});

	$(document).on('click', '.popup-modal-dismiss', function (e) {
		e.preventDefault();
		$.magnificPopup.close();
	});


	/*-----------------------------------------------------*/
	/* Navigation Menu
	------------------------------------------------------ */
	var toggleButton = $('.menu-toggle'),
	    nav = $('.main-navigation');

	function setMenuState(open) {
		toggleButton.toggleClass('is-clicked', open);
		toggleButton.attr('aria-expanded', open ? 'true' : 'false');
	}

	// toggle button
	toggleButton.on('click', function(e) {

		e.preventDefault();
		setMenuState(!toggleButton.hasClass('is-clicked'));
		nav.slideToggle();

	});

	// nav items
	nav.find('li a').on("click", function() {

		// only the small-screen dropdown closes; on wide screens the bar is always visible
		if (toggleButton.is(':visible')) {
			setMenuState(false);
			nav.fadeOut();
		}

	});

	// Escape closes the small-screen dropdown and hands focus back to the menu button
	$(document).on('keydown', function (e) {
		if (e.which === 27 && toggleButton.is(':visible') && toggleButton.hasClass('is-clicked')) {
			setMenuState(false);
			nav.slideUp();
			toggleButton.trigger('focus');
		}
	});

	// leaving the small-screen layout: drop inline styles left by the dropdown animation
	$(window).on('resize', function () {
		if (!toggleButton.is(':visible')) {
			nav.removeAttr('style');
			setMenuState(false);
		}
	});


	/*---------------------------------------------------- */
	/* Highlight the current section in the navigation bar
	------------------------------------------------------ */
	var sections = $("section"),
	    navigation_links = $("#main-nav-wrap li a");

	sections.waypoint( {

		handler: function(direction) {

			var active_section;

			active_section = $('section#' + this.element.id);

			if (direction === "up") active_section = active_section.prev();

			var active_link = $('#main-nav-wrap a[href="#' + active_section.attr("id") + '"]');

			navigation_links.parent().removeClass("current");
			active_link.parent().addClass("current");

		},

		offset: '25%'
	});


	/*---------------------------------------------------- */
	/* Smooth Scrolling
	------------------------------------------------------ */
	$('.smoothscroll').on('click', function (e) {

		var target = this.hash,
		    $target = $(target);

		if (!$target.length) { return; }

		e.preventDefault();

		$('html, body').stop().animate({
			'scrollTop': $target.offset().top
		}, prefersReducedMotion ? 0 : 800, 'swing', function () {
			window.location.hash = target;
		});

	});


	/*---------------------------------------------------- */
	/* Impact stats and the career-at-a-glance rows: a click takes you to the case (or role) that backs them up
	------------------------------------------------------ */
	function spotlight($el) {
		$el.removeClass('is-spotlight');
		void $el[0].offsetWidth; // restart the CSS animation
		$el.addClass('is-spotlight');
		setTimeout(function () { $el.removeClass('is-spotlight'); }, 2600);
	}

	$('.stat-link, .glance-link').on('click', function (e) {

		var id = this.hash,
		    $t = $(id);

		if (!$t.length) { return; }
		e.preventDefault();

		// the target must be visible: bring back cards hidden by a filter, and open the right slide of a carousel
		if ($t.hasClass('is-filtered-out')) { /* stat-reset-filter */ applyCaseFilter('all'); }
		var jumped = false,
		    $slide = $t.closest('.owl-item'),
		    owl = $t.closest('.owl-carousel').data('owlCarousel');
		if ($slide.length && owl && typeof owl.jumpTo === 'function') { owl.jumpTo($slide.index()); jumped = true; }

		setTimeout(function () {
			$('html, body').stop().animate({
				'scrollTop': $t.offset().top - 100
			}, prefersReducedMotion ? 0 : 700, 'swing', function () {
				// replaceState instead of location.hash: the browser would otherwise jump the card under the fixed bar
				if (window.History && History.prototype.replaceState) { History.prototype.replaceState.call(window.history, null, '', id); } /* native-history: see i18n.js */
				$t.attr('tabindex', '-1')[0].focus({ preventScroll: true });
				spotlight($t);
			});
		}, jumped ? 400 : 0);

	});


	/*---------------------------------------------------- */
	/*  Placeholder Plugin Settings
	------------------------------------------------------ */
	$('input, textarea, select').placeholder();


	/*----------------------------------------------------- */
	/* Footer year
	------------------------------------------------------- */
	$('#year-now').text(new Date().getFullYear());


	/*----------------------------------------------------- */
	/* Back to top
	------------------------------------------------------- */
	var pxShow = 300; // height on which the button will show
	var fadeInTime = 400; // how slow/fast you want the button to show
	var fadeOutTime = 400; // how slow/fast you want the button to hide

	// Show or hide the sticky footer button
	jQuery(window).scroll(function() {

		if (jQuery(window).scrollTop() >= pxShow) {
			jQuery("#go-top").fadeIn(fadeInTime);
		} else {
			jQuery("#go-top").fadeOut(fadeOutTime);
		}

	});


	/*----------------------------------------------------- */
	/* Early projects sit behind a button: their carousel was measured while hidden (width 0), so it is measured again when it opens
	------------------------------------------------------- */
	$('.early-projects').on('toggle', function () {
		var owl = $('#owl-slider-port').data('owlCarousel');
		if (this.open && owl && typeof owl.reload === 'function') { owl.reload(); }
		if (window.Waypoint) { window.Waypoint.refreshAll(); }
	});


	/*----------------------------------------------------- */
	/* Re-layout after a language switch (text length changes)
	------------------------------------------------------- */
	$(document).on('i18n:change', function () {

		$('.owl-carousel').each(function () {
			var owl = $(this).data('owlCarousel');
			if (owl && typeof owl.reload === 'function') {
				owl.reload();
				if (owl.options.autoHeight && typeof owl.autoHeight === 'function') { setTimeout(function () { owl.autoHeight(); }, 300); }
			}
		});

		if (window.Waypoint) { window.Waypoint.refreshAll(); }

	});

})(jQuery);
