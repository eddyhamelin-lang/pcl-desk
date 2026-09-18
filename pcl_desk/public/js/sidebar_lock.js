/* ============================================================================
   Phannthamit Desk — one sidebar, everywhere, opened where you work
   ----------------------------------------------------------------------------
   v6. Per-person section order. v5 had the same idea and did nothing: it
   asked the server which section the person works in exactly once, at patch
   time, before frappe.db existed, and never asked again.

   HISTORY, BECAUSE IT MATTERS
   ---------------------------
   v2 rewrote `frappe.boot.workspace_sidebar_item`, pointing all 73 entries at
   the Phannthamit one. The company menu appeared everywhere — and every tile on
   the Desktop grid silently started opening the Command Centre, because those
   tiles are built from `map[key].items[0]`.

   v3 stopped rewriting the map and overrode `resolve_sidebar` instead. Tiles came
   back. But workspace PAGES lost the company menu: `set_workspace_sidebar()`
   returns early and calls `setup(title)` directly, never reaching
   `resolve_sidebar`.

   v4 overrode `setup` as well. That is the shape that works.

   WHAT v5 ADDS
   ------------
   One menu for the whole company is right, but it is long, and the part you
   actually work in was wherever we happened to put it. The Finance Manager
   opened an accounting page and found Sales, Purchasing and Warehouse above her
   own section.

   So: the section matching the person's own `Employee.pcl_home_section` is moved
   to the top, under the three company-wide links. Everything else keeps its
   order. There is still exactly ONE menu record — nothing is duplicated per
   person, so a change made once is a change made for everybody.

   WHY NOT ROLES
   -------------
   Roles cannot tell these people apart. The Finance Manager holds Sales Manager,
   Sales User, Accounts Manager, Accounts User, HR Manager and Stock User; the
   General Manager holds nearly as many. Ordering by role would put the same
   section first for everyone. `pcl_home_section` is set deliberately, by a
   person, and says one thing only: where this person works. It grants nothing.

   WHY NOT `for_user`
   ------------------
   `Workspace Sidebar` carries a `for_user` field, but per-user sidebars are not
   a working feature in v16, and a personal copy of a 60-item menu would drift
   from the shared one within a month.

   WHAT IS DELIBERATELY LEFT ALONE
   -------------------------------
   `items[0]` never moves. The three company-wide links — Command Centre,
   Announcements, Company Handbook — stay at the top, so the Phannthamit tile on
   the Desktop grid still routes to the Command Centre. And no key other than
   "phannthamit" is touched, ever.

   HOW THIS FAILS
   --------------
   If a future Frappe renames `resolve_sidebar` or `setup`, the patch stops
   applying and the sidebar reverts to stock behaviour — visible, harmless.
   Check `frappe.ui.Sidebar.prototype.__pclLocked` after any core update; if it
   is `undefined`, the lock has quietly switched itself off.
   ========================================================================== */
(function () {
	"use strict";

	if (window.__pclSidebarLock) return;
	window.__pclSidebarLock = true;

	var HOME = "Phannthamit";
	var HOME_KEY = "phannthamit";

	var mySection = null;   // filled in asynchronously, once per page load
	var asked = false;

	function home() {
		var map = window.frappe && frappe.boot && frappe.boot.workspace_sidebar_item;
		var h = map && map[HOME_KEY];
		// Absent, or empty, means this person cannot see the company workspace —
		// a role without access to it. Leave their navigation alone rather than
		// handing them a blank sidebar.
		return h && h.items && h.items.length ? h : null;
	}

	// Move the person's own section up, keeping everything else in order.
	// Idempotent: re-running with the same section does nothing.
	function reorder() {
		var h = home();
		if (!h || !mySection || h.__pclOrdered === mySection) return false;

		var items = h.items;
		var lead = [];      // the company-wide links above the first section
		var blocks = [];
		var cur = null;
		var i;

		for (i = 0; i < items.length; i++) {
			if (items[i].type === "Section Break") {
				cur = { label: items[i].label, rows: [items[i]] };
				blocks.push(cur);
			} else if (cur) {
				cur.rows.push(items[i]);
			} else {
				lead.push(items[i]);
			}
		}

		var hit = -1;
		for (i = 0; i < blocks.length; i++) {
			if (blocks[i].label === mySection) hit = i;
		}
		if (hit < 0) return false;

		var out = lead.concat(blocks[hit].rows);
		for (i = 0; i < blocks.length; i++) {
			if (i !== hit) out = out.concat(blocks[i].rows);
		}

		h.items = out;
		h.__pclOrdered = mySection;
		return true;
	}

	function redraw() {
		// Guarded: a redraw is a convenience. If it throws, the new order still
		// applies the next time anything renders the sidebar, and a thrown error
		// here must never cost somebody their navigation.
		try {
			if (frappe.app && frappe.app.sidebar && frappe.app.sidebar.setup) {
				frappe.app.sidebar.setup(HOME);
			}
		} catch (e) {}
	}

	function fetchSection() {
		if (asked || !window.frappe || !frappe.db || !frappe.session) return;
		asked = true;
		try {
			frappe.db
				.get_value("Employee", { user_id: frappe.session.user, status: "Active" },
				           "pcl_home_section")
				.then(function (r) {
					var v = r && r.message && r.message.pcl_home_section;
					if (!v) return;
					mySection = v;
					if (reorder()) redraw();
				});
		} catch (e) {}
	}

	function patch() {
		if (!window.frappe || !frappe.ui || typeof frappe.ui.Sidebar !== "function") {
			return false;
		}
		var P = frappe.ui.Sidebar.prototype;
		if (P.__pclLocked) return true;
		if (typeof P.resolve_sidebar !== "function" || typeof P.setup !== "function") {
			return false;
		}

		var originalResolve = P.resolve_sidebar;
		P.resolve_sidebar = function (entity, module) {
			fetchSection();
			if (home()) { reorder(); return HOME; }
			return originalResolve.call(this, entity, module);
		};

		// Workspace pages never reach resolve_sidebar: set_workspace_sidebar()
		// returns early and calls setup() straight out. This is the other half.
		var originalSetup = P.setup;
		P.setup = function (title) {
			fetchSection();
			if (home()) { reorder(); return originalSetup.call(this, HOME); }
			return originalSetup.call(this, title);
		};

		P.__pclLocked = true;

		// Asked from BOTH overrides, not only here. This patch usually lands
		// before frappe.db exists, and a single attempt at patch time silently
		// did nothing at all - the lock worked, the ordering never fired. The
		// `asked` guard means it still only ever runs once.
		fetchSection();
		return true;
	}

	// app_include_js runs before the desk renders, but frappe.ui.Sidebar arrives
	// with the desk bundle, and on a cold load over mobile data that can take a
	// while. Keep trying for thirty seconds and stop the moment it takes; a fixed
	// ladder of four attempts is what made the menu "disappear at random".
	if (!patch()) {
		var tries = 0;
		var settle = setInterval(function () {
			tries = tries + 1;
			if (patch() || tries > 120) clearInterval(settle);
		}, 250);
	}
})();
