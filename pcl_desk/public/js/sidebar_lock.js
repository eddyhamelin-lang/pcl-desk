/* pcl_desk — sidebar_lock.js
 *
 * Keeps one Phannthamit menu on the left of every desk page, instead of the
 * stock module menu that Frappe swaps in the moment anyone opens a record.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 3 NOVEMBER 2026 — REWRITTEN. The previous version had been dead for eleven
 * days and nobody could see why.
 *
 * It worked on `frappe.boot.workspace_sidebar_item`, a map of 73 lowercased
 * workspace names to the sidebar to draw on each, and pointed all 73 keys at
 * the Phannthamit entry. The v16.53 framework jump on 23 October DELETED that
 * key. The boot object now carries `module_sidebars` instead, keyed by MODULE
 * rather than by workspace, so from that day this file rewrote something that
 * no longer existed, failed silently, and the company menu stopped following
 * anyone anywhere. That is the regression the staff reported as "it is not as
 * easy to navigate as it was before".
 *
 * Verified live on 3 November before this was written: assigning
 * module_sidebars["Selling"] the Phannthamit entry and calling
 * load_sidebar_data() + setup() put all 84 links and all seven collapsible
 * headings onto a Quotation list.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AND IT IS NOW SCOPED BY ROLE, which the old one was not.
 *
 * The old version forced the same full menu on everybody. That is wrong here:
 * a person should see the part of the business they work in. Frappe cannot do
 * this on its own — a sidebar item has no `roles` field, and the permission
 * filter it does apply works on DocType read permission, which on this site is
 * far wider than anyone's job. `Stock User` alone carries read on Sales Order,
 * Customer, Supplier, Purchase Order, Territory and Warehouse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 4 NOVEMBER 2026 — THE DEFAULT IS NOW THE FULL TREE, NOT "DO NOTHING".
 *
 * The scoped menus were assigned to two people on the morning of 4 November
 * and both reported the same thing within the hour. Tevy: "the sidebar is
 * missing some functions that used to be there. It looks pretty empty now.
 * Also there are no more coloured icons. We actually prefer the previous
 * layout... sales map is missing, quality inspection too." Theara: "I can see
 * only this function Eddy."
 *
 * All three complaints were accurate, and the data says why:
 *   - The Phannthamit menu is 84 links under 7 collapsible headings and EVERY
 *     item carries an `icon`. The Sales menu is 11 links and NOT ONE of them
 *     has an icon field at all. Same for Finance at 9.
 *   - Sales Map is item 15 of the Phannthamit tree and Quality Inspections is
 *     item 63. Neither appears in the Sales menu. Tevy inspects incoming goods
 *     AND works the territory, so scoping her to one menu took away half her
 *     job by design.
 *
 * That is the real lesson and it is worth writing down: the audience table
 * assumes one person belongs to one area. In a company this size nobody does.
 * Theara is finance, HR, purchasing and office administration. Tevy is sales
 * and quality. A menu that names one area is wrong for both of them, and no
 * ordering of the table fixes that.
 *
 * So the no-match default changes from "leave the desk alone" to "draw the
 * company tree". Eddy's decision, 4 November.
 *
 * THIS DOES NOT WIDEN WHAT ANYONE CAN OPEN. Frappe filters every sidebar link
 * through `is_item_allowed` -> `frappe.has_permission` as it draws it, so each
 * person sees their own subset of the 84. The permission system does the
 * scoping, which is where scoping belongs — a hand-maintained menu is not a
 * security control and never was. The audience table stays for the case where
 * someone genuinely should be pinned to one area, such as a future warehouse
 * hire; it is simply no longer what happens by default.
 */

(function () {
	"use strict";

	/* ══ THE ONLY PART MEANT TO BE EDITED ═══════════════════════════════════
	 *
	 * Who gets which menu. By ROLE, never by a person's name, so the menu
	 * follows the job rather than the individual.
	 *
	 * FIRST MATCH WINS, so the widest audience is listed first.
	 *
	 * `sidebar` is the name of a Sidebar record, which is also the name of the
	 * module it belongs to. Those records are editable in the desk, so the
	 * CONTENTS of each menu can be changed without touching this file or
	 * redeploying. Only this table needs a deploy.
	 */
	var AUDIENCES = [
		// Directors and the GM run the whole company, so they get the whole tree:
		// 84 links under Sales, Purchasing, Warehouse, Finance, Regulatory &
		// Quality, HR & Admin and Training.
		{ role: "PCL Director", sidebar: "Phannthamit" },
		{ role: "PCL Executive Signatory", sidebar: "Phannthamit" },

		// Everyone else gets their own area. These three roles already exist on
		// the site and are deliberately held by NOBODY as this ships — so on the
		// day it goes live nothing changes for anyone but the three people above.
		// Assigning them is a separate, visible, reversible decision.
		{ role: "PCL View Finance", sidebar: "Finance" },
		{ role: "PCL View Sales", sidebar: "Sales" },
		{ role: "PCL View Operations", sidebar: "Warehouse Operations" },

		// This role does NOT exist yet. Create it and assign it if quality should
		// get its own menu; until then the line simply never matches.
		{ role: "PCL View Quality", sidebar: "Regulatory & Quality" }
	];

	/* What everybody else gets. Set to null to go back to the 3 November
	 * behaviour, where someone holding no audience role was left with whatever
	 * Frappe drew for the module they happened to be on.
	 *
	 * This is the pre-v16 layout the staff asked for by name on 4 November:
	 * the company tree, with its headings and its icons, on every page.
	 */
	var DEFAULT_SIDEBAR = "Phannthamit";

	/* Why audience roles rather than the job roles people already hold:
	 * the job roles overlap too much to tell anyone apart. Finance holds
	 * Sales Manager; Sales & Marketing holds Quality Manager and signs quality
	 * inspections with it. Any ordering of those roles gives at least one person
	 * the wrong menu. A role whose only purpose is to say "this is your menu"
	 * cannot collide with anything.
	 *
	 * NOBODY MATCHES? Then DEFAULT_SIDEBAR applies — the full company tree as
	 * of 4 November 2026. If that menu is ever missing or empty this file still
	 * does nothing at all, so the failure mode of a navigation change remains
	 * the stock navigation and never a blank one.
	 */

	function chooseSidebarName(roles) {
		for (var i = 0; i < AUDIENCES.length; i++) {
			if (roles.indexOf(AUDIENCES[i].role) !== -1) {
				return AUDIENCES[i].sidebar;
			}
		}
		return DEFAULT_SIDEBAR;
	}

	function apply() {
		var boot = window.frappe && frappe.boot;
		if (!boot) return false;

		var all = boot.module_sidebars;
		if (!all || typeof all !== "object") return false;

		var roles = (boot.user && boot.user.roles) || [];
		if (!roles.length) return false;

		var wanted = chooseSidebarName(roles);
		if (!wanted) return true; // DEFAULT_SIDEBAR is null — leave the desk alone, and stop trying

		var source = all[wanted];
		if (!source || !source.items || !source.items.length) {
			// The menu named above is missing or empty. Doing nothing is right:
			// a wrong menu is worse than the stock one, and an empty one is worse
			// than both.
			return true;
		}

		Object.keys(all).forEach(function (key) {
			var target = all[key];
			if (!target) return;
			if (target.__pclLocked === wanted) return;

			// Copy the chosen menu's contents, but keep each module's own identity
			// so the app rail and the header still know which module they are on.
			all[key] = {
				name: target.name,
				module: target.module,
				label: target.label,
				app: target.app,
				header_icon: target.header_icon,
				module_onboarding: target.module_onboarding,
				customized: target.customized,
				computed: target.computed,
				workspaces: target.workspaces,
				items: source.items,
				__pclLocked: wanted
			};
		});

		return true;
	}

	// Runs from app_include_js, which desk.html loads after the inline script
	// that assigns frappe.boot and before the desk renders — so the map is
	// already rewritten the first time anything reads it.
	var done = apply();

	// Frappe rebuilds its sidebar on navigation. It reads the map we just
	// rewrote, so one pass is normally enough — but re-applying before each read
	// costs nothing and survives anything that repopulates boot later.
	function guard() {
		if (!window.frappe || !frappe.app || !frappe.app.sidebar) return false;
		var sidebar = frappe.app.sidebar;
		if (sidebar.__pclGuarded) return true;
		var original = sidebar.load_sidebar_data;
		if (typeof original !== "function") return false;
		sidebar.__pclGuarded = true;
		sidebar.load_sidebar_data = function () {
			try {
				apply();
			} catch (e) {
				// Never let this stop the desk drawing its own menu.
				console.error("pcl_desk sidebar_lock:", e);
			}
			return original.apply(this, arguments);
		};
		return true;
	}

	// boot is there immediately; frappe.app.sidebar is built a moment later.
	if (!guard()) {
		var tries = 0;
		var timer = setInterval(function () {
			tries++;
			if (!done) done = apply();
			if (guard() || tries > 40) clearInterval(timer);
		}, 150);
	}
})();
