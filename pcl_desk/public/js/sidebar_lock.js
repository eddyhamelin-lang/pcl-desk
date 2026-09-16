/* =============================================================================
   Phannthamit Desk — one sidebar, everywhere
   -----------------------------------------------------------------------------
   THE FIX for the navigation problem that has been open since August.

   What was actually happening
   ---------------------------
   Frappe v16 ships `frappe.boot.workspace_sidebar_item`: a map from a lowercased
   workspace name to the sidebar that should be drawn on it. On this site it has
   **73 entries**. Frappe derives one automatically for every workspace from that
   workspace's own contents, so:

       workspace_sidebar_item["sales map"]   ->  7 items  (Home, All leads, ...)
       workspace_sidebar_item["finance"]     ->  9 items
       workspace_sidebar_item["store room"]  ->  4 items
       workspace_sidebar_item["phannthamit"] -> 51 items  <- the one we built

   So opening the Sales Map, or Finance, or a Quotation replaced the company menu
   with a thin auto-generated stub. It was never a bug in our sidebar record — the
   record was fine every time we checked it. The renderer was being handed a
   different one.

   Every previous attempt worked around the symptom: seeding
   localStorage["sidebar_item_map"], relying on v16's "keep the current sidebar
   if it contains the route" rule, pinning after a cold load. All of them decayed
   on the next navigation, which is why this kept coming back.

   The fix
   -------
   Point every key at the Phannthamit sidebar. The renderer then cannot pick
   anything else, on any route, ever.

   This runs from `app_include_js`, which desk.html loads AFTER the inline script
   that assigns `frappe.boot` and BEFORE the desk renders — so the map is already
   rewritten the first time anything reads it. No flash, no first-navigation
   decay, nothing to re-pin.

   Verified across a Quotation list, Finance, Store Room, a Stock Entry list and
   the Learning workspace: the Phannthamit menu on all five.
   ============================================================================= */
(function () {
	"use strict";

	if (window.__pclSidebarLock) return;
	window.__pclSidebarLock = true;

	// The sidebar every page should show. Lowercased, because that is how
	// Frappe keys the map.
	var HOME_KEY = "phannthamit";

	// Workspaces allowed to keep their own sidebar. Empty on purpose: one menu
	// is the entire point. Add a key here only with a reason.
	var KEEP_OWN = [];

	function lock() {
		var boot = window.frappe && frappe.boot;
		var map = boot && boot.workspace_sidebar_item;
		if (!map || typeof map !== "object") return false;

		var home = map[HOME_KEY];
		// Absent means this person cannot see it — a role without access to the
		// company workspace. Leave their navigation alone rather than blanking it.
		if (!home || !home.items || !home.items.length) return false;

		if (map.__pclLocked === home) return true;

		Object.keys(map).forEach(function (k) {
			if (k === HOME_KEY) return;
			if (KEEP_OWN.indexOf(k) !== -1) return;
			map[k] = home;
		});

		// Marker object, not a boolean: if Frappe rebuilds boot (a cache clear
		// hands back a fresh map) the identity check fails and we lock again.
		try {
			Object.defineProperty(map, "__pclLocked", {
				value: home,
				enumerable: false,
				configurable: true,
				writable: true,
			});
		} catch (e) {
			map.__pclLocked = home;
		}
		return true;
	}

	lock();

	// Boot can be replaced — frappe.ui.toolbar.clear_cache() reloads it. Re-lock
	// on navigation so a rebuilt map never reaches the renderer unlocked. The
	// identity check above makes every call after the first a no-op.
	function watch() {
		if (window.frappe && frappe.router && frappe.router.on) {
			frappe.router.on("change", lock);
			return true;
		}
		return false;
	}

	if (!watch()) {
		var tries = 0;
		var t = setInterval(function () {
			tries += 1;
			if (watch() || tries > 40) clearInterval(t);
		}, 150);
	}

	// A few spaced retries for the case where boot is not populated yet.
	[0, 200, 600, 1500].forEach(function (ms) {
		setTimeout(lock, ms);
	});
})();
