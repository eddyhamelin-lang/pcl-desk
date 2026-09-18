/* ============================================================================
   Phannthamit Desk — one sidebar, everywhere
   ----------------------------------------------------------------------------
   Third attempt, and the first one that does not break navigation.

   The previous version pointed every one of the 73 entries in
   `frappe.boot.workspace_sidebar_item` at the Phannthamit entry, so the renderer
   could not pick anything else. The company menu was on every page. It also
   broke navigation, and nobody saw it until 18 September.

   That map is not only read by the sidebar. The Desktop grid — the page of tiles
   you get from the app menu — builds each tile's link from the FIRST ITEM of
   that workspace's sidebar: get_route_for_icon(map[key].items[0]).

   So every tile inherited Phannthamit's first item, Command Centre:

       Invoicing    ->  /desk/phannthamit?sidebar=Invoicing
       Payments     ->  /desk/phannthamit?sidebar=Payments
       Selling      ->  /desk/phannthamit?sidebar=Selling
       Organization ->  /desk/phannthamit?sidebar=Organization

   Only the ?sidebar= part differed, and that had been made meaningless because
   every sidebar WAS the company menu. The Finance Manager clicked
   Desktop -> Accounting -> Invoicing and landed back on the command centre,
   three times.

   THE FIX: do not touch the routing data. Frappe decides which sidebar to draw
   in exactly one place —

       frappe.ui.Sidebar.prototype.resolve_sidebar(entity, module)

   Overriding it to answer "Phannthamit" gives the same guarantee at the point
   where the decision is actually made, and leaves workspace_sidebar_item exactly
   as Frappe built it. Every tile and link then routes where it says it does.

   HOW THIS FAILS: if a future Frappe renames resolve_sidebar, the patch stops
   applying and the sidebar reverts to stock — a nuisance you can see. The old
   version's failure mode was navigation silently going somewhere else.
   ========================================================================== */
(function () {
	"use strict";

	if (window.__pclSidebarLock) return;
	window.__pclSidebarLock = true;

	var HOME = "Phannthamit";
	var HOME_KEY = "phannthamit";

	function patch() {
		if (!window.frappe || !frappe.ui || typeof frappe.ui.Sidebar !== "function") {
			return false;
		}
		var P = frappe.ui.Sidebar.prototype;
		if (P.__pclLocked) return true;
		if (typeof P.resolve_sidebar !== "function") return false;

		var original = P.resolve_sidebar;
		P.resolve_sidebar = function (entity, module) {
			var map = frappe.boot && frappe.boot.workspace_sidebar_item;
			var home = map && map[HOME_KEY];
			// Absent or empty means this person cannot see the company workspace
			// — a role without access. Leave their navigation alone rather than
			// handing them a blank sidebar.
			if (home && home.items && home.items.length) return HOME;
			return original.call(this, entity, module);
		};

		P.__pclLocked = true;
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
