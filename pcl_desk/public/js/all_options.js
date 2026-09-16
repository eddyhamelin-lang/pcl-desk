/* =============================================================================
   Phannthamit Desk — navbar buttons and the All Options drawer
   -----------------------------------------------------------------------------
   Why the drawer exists, in one sentence: Frappe v16 swaps the left sidebar for
   whichever module owns the doctype you just opened, so the Phannthamit menu
   disappears the moment anybody opens a Quotation. This is the way back — the
   whole menu, searchable, from anywhere, without needing the sidebar to be the
   right one. See claude/navigation-and-ui.md for the original diagnosis.

   The idea came from Solvronix Desk (MIT). The implementation does not: theirs
   listed every workspace on the site, including Build, Users, Website and
   Subcontracting, which is a firehose. Ours mirrors the Phannthamit sidebar,
   which is navigation somebody actually curated.
   ============================================================================= */
(function () {
	"use strict";

	if (window.__pclAllOptions) return;
	window.__pclAllOptions = true;

	var SIDEBAR_NAME = "Phannthamit";

	// Workspaces that earn the extra width: maps, wide tables, dashboards.
	// A 1600px-wide page of prose is worse than a narrow one, so this is a
	// list rather than a blanket setting.
	var WIDE_ROUTES = ["Sales Map"];

	var NAV = null; // cached sidebar rows
	var $drawer = null;
	var $backdrop = null;

	/* ---- helpers ---------------------------------------------------------- */

	function icon(name, cls) {
		if (!name) name = "small-file";
		return (
			'<svg class="icon ' + (cls || "") + '" aria-hidden="true">' +
			'<use href="#icon-' + name + '"></use></svg>'
		);
	}

	function esc(s) {
		return frappe.utils.escape_html(s == null ? "" : String(s));
	}

	function lsGet(k, fallback) {
		try {
			var v = localStorage.getItem(k);
			return v === null ? fallback : v;
		} catch (e) {
			return fallback;
		}
	}

	function lsSet(k, v) {
		try {
			localStorage.setItem(k, v);
		} catch (e) {
			/* private window, blocked storage — the control still works for
			   this session, it just will not be remembered. */
		}
	}

	/* ---- per-browser display preferences ----------------------------------
	   Font size and density live in localStorage on purpose: a phone wants
	   bigger text than a 27-inch monitor and the same person uses both, so
	   these are per-device rather than per-account. Theme is different — it
	   goes on the User record, because that IS a per-person preference and
	   Frappe already stores it. */

	function applyDisplayPrefs() {
		var root = document.documentElement;
		root.setAttribute("data-pcl-font", lsGet("pcl_font", "md"));
		root.setAttribute("data-pcl-density", lsGet("pcl_density", "comfortable"));
	}

	function setFont(size) {
		lsSet("pcl_font", size);
		applyDisplayPrefs();
		paintAppearance();
	}

	function setDensity(d) {
		lsSet("pcl_density", d);
		applyDisplayPrefs();
		paintAppearance();
	}

	function currentTheme() {
		// Frappe writes the attribute lowercase ("light") but stores the User
		// field capitalised ("Light"). Normalise or the segmented control never
		// shows which option is selected — which is how this was caught.
		var raw =
			(frappe.boot && frappe.boot.user && frappe.boot.user.desk_theme) ||
			document.documentElement.getAttribute("data-theme-mode") ||
			"Light";
		raw = String(raw).toLowerCase();
		if (raw === "dark") return "Dark";
		if (raw === "automatic" || raw === "auto") return "Automatic";
		return "Light";
	}

	function setTheme(theme) {
		// Written to the User record so it follows the person to any browser.
		try {
			frappe.xcall("frappe.core.doctype.user.user.switch_theme", { theme: theme });
		} catch (e) {
			/* older builds may not expose it; the local switch below still works */
		}
		if (frappe.ui && frappe.ui.set_theme) {
			frappe.ui.set_theme(theme === "Automatic" ? null : theme.toLowerCase());
		}
		if (frappe.boot && frappe.boot.user) frappe.boot.user.desk_theme = theme;
		paintAppearance();
	}

	/* ---- the wide-page class ---------------------------------------------- */

	function applyWide() {
		var r = (frappe.get_route && frappe.get_route()) || [];
		var on = r[0] === "Workspaces" && WIDE_ROUTES.indexOf(r[1]) !== -1;
		var was = document.body.classList.contains("pcl-wide");
		document.body.classList.toggle("pcl-wide", on);

		// Leaflet measures its container once and caches the result. Widening
		// the page underneath a live map leaves it drawing tiles for the old
		// width — a strip of blank on the right that looks like a broken map.
		// The Sales Map block exposes its map as window.pclMapHandle for
		// exactly this kind of reach-in.
		if (was !== on && window.pclMapHandle && window.pclMapHandle.invalidateSize) {
			setTimeout(function () {
				try {
					window.pclMapHandle.invalidateSize();
				} catch (e) {
					/* map gone with the page — nothing to resize */
				}
			}, 240);
		}
	}

	/* ---- navigation data --------------------------------------------------- */

	function loadNav() {
		if (NAV) return Promise.resolve(NAV);
		return frappe
			.xcall("frappe.client.get", {
				doctype: "Workspace Sidebar",
				name: SIDEBAR_NAME,
			})
			.then(function (doc) {
				NAV = (doc && doc.items) || [];
				return NAV;
			})
			.catch(function () {
				// Fall back to plain workspaces if the sidebar record is not
				// readable for this person. Better a shorter list than nothing.
				return frappe
					.xcall("frappe.client.get_list", {
						doctype: "Workspace",
						filters: { public: 1 },
						fields: ["name", "title", "icon"],
						limit_page_length: 100,
						order_by: "sequence_id asc",
					})
					.then(function (rows) {
						NAV = (rows || []).map(function (w) {
							return {
								label: w.title || w.name,
								icon: w.icon,
								link_type: "Workspace",
								link_to: w.name,
								indent: 0,
							};
						});
						return NAV;
					})
					.catch(function () {
						NAV = [];
						return NAV;
					});
			});
	}

	// Section headings carry indent 1 and the rows beneath them carry 0, which
	// reads backwards but is what the data says. Trust the flag rather than
	// inferring from "has no link" — Training Portal is a URL link with no
	// link_to and was being drawn as a heading.
	function isSection(item) {
		return item.indent === 1;
	}

	function routeFor(item) {
		if (item.link_type === "Workspace" && item.link_to) {
			return ["Workspaces", item.link_to];
		}
		if (item.link_type === "DocType" && item.link_to) {
			return ["List", item.link_to];
		}
		if (item.link_type === "Report" && item.link_to) {
			return ["query-report", item.link_to];
		}
		if (item.link_type === "Page" && item.link_to) {
			return [item.link_to];
		}
		return null;
	}

	// Not every row is a desk route. Training Portal points at /lms.
	function go(item) {
		if (item.link_type === "URL" && item.url) {
			closeDrawer();
			window.location.href = item.url;
			return true;
		}
		var route = routeFor(item);
		if (route) {
			closeDrawer();
			frappe.set_route.apply(frappe, route);
			return true;
		}
		return false;
	}

	/* ---- rendering --------------------------------------------------------- */

	function paintAppearance() {
		if (!$drawer) return;
		var theme = currentTheme();
		var font = lsGet("pcl_font", "md");
		var density = lsGet("pcl_density", "comfortable");
		var map = { theme: theme, font: font, density: density };
		$drawer.querySelectorAll("[data-group]").forEach(function (btn) {
			var g = btn.getAttribute("data-group");
			btn.classList.toggle("pcl-on", btn.getAttribute("data-value") === map[g]);
		});
	}

	function renderNav(filter) {
		var body = $drawer.querySelector(".pcl-nav-list");
		var q = (filter || "").trim().toLowerCase();
		var html = "";
		var shown = 0;

		(NAV || []).forEach(function (item) {
			var label = item.label || "";
			if (!label) return;
			var section = isSection(item);

			if (q) {
				// While searching, drop the section headings and show a flat
				// list of matches — headings are noise once you are filtering.
				if (section) return;
				if (label.toLowerCase().indexOf(q) === -1) return;
			}

			if (section) {
				html += '<div class="pcl-nav-section">' + esc(label) + "</div>";
				return;
			}

			shown += 1;
			html +=
				'<button class="pcl-nav-item" data-idx="' + item.idx + '">' +
				icon(item.icon) +
				"<span>" + esc(label) + "</span></button>";
		});

		if (q && !shown) {
			html = '<div class="pcl-nav-empty">Nothing here matches &ldquo;' + esc(filter) + "&rdquo;.</div>";
		}

		body.innerHTML = html;

		body.querySelectorAll(".pcl-nav-item").forEach(function (btn) {
			btn.addEventListener("click", function () {
				var idx = parseInt(btn.getAttribute("data-idx"), 10);
				var item = (NAV || []).filter(function (i) {
					return i.idx === idx;
				})[0];
				if (item) go(item);
			});
		});
	}

	function buildDrawer() {
		if ($drawer) return;

		$backdrop = document.createElement("div");
		$backdrop.className = "pcl-drawer-backdrop";
		$backdrop.addEventListener("click", closeDrawer);

		$drawer = document.createElement("div");
		$drawer.className = "pcl-drawer";
		$drawer.setAttribute("role", "dialog");
		$drawer.setAttribute("aria-label", "All options");
		$drawer.innerHTML =
			'<div class="pcl-drawer-head">' +
			"<h5>All options</h5>" +
			'<button class="pcl-drawer-close" aria-label="Close">&times;</button>' +
			"</div>" +
			'<div class="pcl-drawer-body">' +
			'<input class="pcl-drawer-search" type="text" placeholder="Search the menu…" aria-label="Search the menu">' +
			'<div class="pcl-drawer-label">Appearance</div>' +
			'<div class="pcl-seg-row"><span>Theme</span><span class="pcl-seg">' +
			'<button data-group="theme" data-value="Light">Light</button>' +
			'<button data-group="theme" data-value="Dark">Dark</button>' +
			'<button data-group="theme" data-value="Automatic">Auto</button>' +
			"</span></div>" +
			'<div class="pcl-seg-row"><span>Text size</span><span class="pcl-seg">' +
			'<button data-group="font" data-value="sm">A-</button>' +
			'<button data-group="font" data-value="md">A</button>' +
			'<button data-group="font" data-value="lg">A+</button>' +
			"</span></div>" +
			'<div class="pcl-seg-row"><span>Spacing</span><span class="pcl-seg">' +
			'<button data-group="density" data-value="comfortable">Comfortable</button>' +
			'<button data-group="density" data-value="compact">Compact</button>' +
			"</span></div>" +
			'<div class="pcl-drawer-label">Go to</div>' +
			'<div class="pcl-nav-list"></div>' +
			"</div>";

		document.body.appendChild($backdrop);
		document.body.appendChild($drawer);

		$drawer.querySelector(".pcl-drawer-close").addEventListener("click", closeDrawer);

		$drawer.querySelector(".pcl-drawer-search").addEventListener("input", function (e) {
			renderNav(e.target.value);
		});

		$drawer.querySelectorAll("[data-group]").forEach(function (btn) {
			btn.addEventListener("click", function () {
				var g = btn.getAttribute("data-group");
				var v = btn.getAttribute("data-value");
				if (g === "theme") setTheme(v);
				else if (g === "font") setFont(v);
				else if (g === "density") setDensity(v);
			});
		});

		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && $drawer && $drawer.classList.contains("pcl-open")) {
				closeDrawer();
			}
		});
	}

	function openDrawer() {
		buildDrawer();
		loadNav().then(function () {
			renderNav("");
			paintAppearance();
			$backdrop.classList.add("pcl-open");
			$drawer.classList.add("pcl-open");
			var s = $drawer.querySelector(".pcl-drawer-search");
			s.value = "";
			setTimeout(function () {
				s.focus();
			}, 180);
		});
	}

	function closeDrawer() {
		if (!$drawer) return;
		$drawer.classList.remove("pcl-open");
		$backdrop.classList.remove("pcl-open");
	}

	/* ---- navbar buttons ----------------------------------------------------
	   v16 has no top navbar to hang these on — the page head is the only
	   always-present strip. Solvronix solved this by stacking a second bar of
	   its own above Frappe's, which on the app grid produced two search boxes,
	   two avatars and forty pixels of nothing. We use the row that is already
	   there instead of adding one. */

	var BUTTONS = [
		{
			key: "back",
			icon: "arrow-left",
			title: "Back",
			text: "Back",
			// Lives here rather than on the form toolbar, which is where it used
			// to be as 30 Client Scripts. Those only existed on forms, so there
			// was no Back on a workspace, a list or a report — which is exactly
			// where people got stuck. One button, every page.
			//
			// The breadcrumb is not a substitute: it goes to the LIST, and you
			// very often came from the map, a search, or another record.
			show: function () {
				return window.history.length > 1;
			},
			run: function () {
				window.history.back();
			},
		},
		{
			key: "search",
			icon: "search",
			title: "Search  (Ctrl+K)",
			kbd: "Ctrl K",
			run: function () {
				// v16 has no inline search field — the sidebar's Search row opens
				// a modal, and Ctrl+K opens the same one. Click that row rather
				// than building a second search box; two search boxes on one
				// screen is exactly the mistake this app exists to avoid.
				var el =
					document.querySelector("#navbar-modal-search .item-anchor") ||
					document.querySelector("#navbar-modal-search");
				if (el) {
					el.click();
					return;
				}
				if (frappe.search && frappe.search.SearchDialog) {
					new frappe.search.SearchDialog();
				}
			},
		},
		{
			key: "home",
			icon: "home",
			title: "Company Home",
			run: function () {
				frappe.set_route("Workspaces", SIDEBAR_NAME);
			},
		},
		{
			key: "tasks",
			icon: "list-checks",
			title: "My tasks",
			run: function () {
				frappe.set_route("List", "ToDo", {
					status: "Open",
					allocated_to: frappe.session.user,
				});
			},
		},
		{
			key: "options",
			icon: "menu",
			title: "All options",
			text: "All options",
			run: openDrawer,
		},
	];

	function injectButtons() {
		// Frappe keeps one .page-head per page container and hides the inactive
		// ones rather than removing them, so there are several in the DOM at
		// once. querySelector would happily pick a hidden one and the buttons
		// would silently never appear — inject into all of them instead. Each
		// call is a no-op where they are already present.
		document.querySelectorAll(".page-head .page-actions").forEach(injectInto);
	}

	function injectInto(host) {
		if (!host) return;

		var existing = host.querySelector(".pcl-navbar-group");
		if (existing) {
			// history.length starts at 1 in a cold tab and grows on the first
			// navigation, so whether Back belongs here can change after the
			// group was built. Rebuild only when it actually disagrees.
			var wantBack = window.history.length > 1;
			var hasBack = !!existing.querySelector(".pcl-btn-back");
			if (wantBack === hasBack) return;
			existing.remove();
		}

		var wrap = document.createElement("div");
		wrap.className = "pcl-navbar-group";
		wrap.style.display = "inline-flex";
		wrap.style.alignItems = "center";
		wrap.style.gap = "2px";
		wrap.style.marginRight = "6px";

		BUTTONS.forEach(function (b) {
			// A button that would do nothing is worse than no button. Back is
			// hidden on a page opened cold in a fresh tab.
			if (b.show && !b.show()) return;

			var el = document.createElement("button");
			el.className = "pcl-navbar-btn pcl-btn-" + b.key;
			el.type = "button";
			el.title = b.title;
			el.setAttribute("aria-label", b.title);
			el.innerHTML =
				icon(b.icon) +
				(b.text ? '<span class="pcl-btn-text">' + esc(b.text) + "</span>" : "") +
				(b.kbd ? '<span class="pcl-kbd">' + esc(b.kbd) + "</span>" : "");
			el.addEventListener("click", b.run);
			wrap.appendChild(el);
		});

		var standard = host.querySelector(".standard-actions");
		if (standard) host.insertBefore(wrap, standard);
		else host.appendChild(wrap);
	}

	/* ---- wiring ------------------------------------------------------------ */

	function tick() {
		applyWide();
		injectButtons();
	}

	function start() {
		applyDisplayPrefs();
		tick();

		if (frappe.router && frappe.router.on) {
			frappe.router.on("change", function () {
				// The page head is rebuilt per route, so the buttons have to be
				// re-inserted. Cheap: injectButtons() returns immediately when
				// they are already present.
				setTimeout(tick, 60);
				setTimeout(tick, 400);
			});
		}

		// Some pages build their head late. A few spaced retries cost nothing
		// and save a button that silently never appears.
		[300, 900, 2000].forEach(function (t) {
			setTimeout(tick, t);
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start);
	} else {
		start();
	}
})();
