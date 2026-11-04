/* pcl_desk — sidebar_icons.js
 *
 * Draws the icon that is already in the data but that Frappe v16 does not
 * render on a nested sidebar item.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 4 NOVEMBER 2026 — WHY THIS EXISTS.
 *
 * Tevy, on the new navigation: "there are no more coloured icons." She was
 * right, and the reason is not the menu — it is the framework.
 *
 * Every one of the 84 items in the Phannthamit sidebar carries an `icon`:
 * Quotations is `file-text`, Sales Map is `map-pin`, Quality Inspections is
 * `flask-conical`. But an item nested under a Section Break heading has
 * `child: 1`, and for those v16 omits the icon element from the template
 * altogether. Measured on the live site: 84 items, 74 of them children with an
 * icon in the data, and exactly THREE icons on screen — the three top-level
 * entries that sit above the first heading.
 *
 * So the company tree came back looking flat and grey, and the stored icons
 * were doing nothing at all.
 *
 * WHAT THIS DOES. After the sidebar renders, it walks the items, finds the
 * ones whose anchor has no icon element, and inserts the SAME markup v16 uses
 * for a top-level item:
 *
 *     <span class="sidebar-item-icon" item-icon="NAME">
 *       <svg class="icon current-color icon-sm" stroke="currentColor">
 *         <use href="#icon-NAME"></use>
 *       </svg>
 *     </span>
 *
 * It invents nothing. The icon name comes from the sidebar record, and the
 * glyph comes from Frappe's own sprite — all 51 distinct icons this menu uses
 * were confirmed present in the sprite before this file was written, so there
 * is no new asset and no new request.
 *
 * WHY NOT CSS. A stylesheet cannot insert an <svg><use> reference, so the only
 * CSS route is 81 hand-written background-image rules keyed on the item label.
 * That breaks the first time anybody renames a menu entry, and it puts the
 * icon in a different place from the one Frappe puts it. Reusing the
 * framework's own markup means these icons inherit theme, dark mode, hover and
 * active colour for free.
 *
 * WHY NOT IN sidebar_lock.js. That file decides WHICH menu a person gets. This
 * one decides how an item is drawn. Different jobs, and the lock is the file
 * that has already been rewritten twice this fortnight — it does not need a
 * second reason to change.
 *
 * FAILURE MODE. An icon the sprite does not have is skipped, so that row keeps
 * the plain label it has today rather than showing a broken glyph. Everything
 * runs inside try/catch: if this file fails completely the sidebar is exactly
 * what it is now, which is working, just grey.
 */

(function () {
	"use strict";

	var MARK = "data-pcl-icon";

	/* Label -> icon name, read from whatever menus the boot object carries.
	 *
	 * Built fresh each time there is work to do rather than cached, because
	 * sidebar_lock rewrites module_sidebars and a cached map taken before that
	 * would be stale. There is only work to do when the sidebar has just been
	 * re-rendered, so this runs rarely.
	 */
	function iconsByLabel() {
		var map = {};
		var all = (window.frappe && frappe.boot && frappe.boot.module_sidebars) || {};
		Object.keys(all).forEach(function (key) {
			var items = all[key] && all[key].items;
			if (!items || !items.length) return;
			items.forEach(function (it) {
				if (it && it.label && it.icon && !map[it.label]) {
					map[it.label] = it.icon;
				}
			});
		});
		return map;
	}

	function spriteHas(name) {
		// Frappe inlines its icon sprite into the page as <symbol id="icon-NAME">.
		return !!document.getElementById("icon-" + name);
	}

	function paint() {
		var pending = document.querySelectorAll(
			".sidebar-item-container[data-id]:not([" + MARK + "])"
		);
		if (!pending.length) return;

		var map = iconsByLabel();
		var added = 0;

		Array.prototype.forEach.call(pending, function (box) {
			// Mark first, so a row we decide to skip is not reconsidered every
			// frame for the rest of the session.
			box.setAttribute(MARK, "1");

			// Only this item's own anchor, never a descendant's.
			var anchor = box.querySelector(
				":scope > .standard-sidebar-item > a.item-anchor"
			);
			if (!anchor) return;                                  // a heading with no link
			if (anchor.querySelector(".sidebar-item-icon")) return; // v16 already drew one

			var name = map[box.getAttribute("data-id")];
			if (!name || !spriteHas(name)) return;

			var span = document.createElement("span");
			span.className = "sidebar-item-icon";
			span.setAttribute("item-icon", name);

			var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.setAttribute("class", "icon current-color icon-sm");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("aria-hidden", "true");

			var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
			use.setAttribute("href", "#icon-" + name);

			svg.appendChild(use);
			span.appendChild(svg);
			anchor.insertBefore(span, anchor.firstChild);
			added++;
		});

		return added;
	}

	function safePaint() {
		try {
			paint();
		} catch (e) {
			// Never let a cosmetic pass break the desk.
			console.error("pcl_desk sidebar_icons:", e);
		}
	}

	/* Frappe rebuilds the sidebar on navigation and on collapse/expand, and the
	 * rebuilt rows arrive without our mark, so they get painted on the next
	 * frame. One rAF-debounced pass per batch of mutations; the pass itself
	 * starts with a single querySelectorAll that matches nothing almost every
	 * time, so the steady-state cost is negligible.
	 */
	var queued = false;
	function schedule() {
		if (queued) return;
		queued = true;
		window.requestAnimationFrame(function () {
			queued = false;
			safePaint();
		});
	}

	function start() {
		safePaint();
		try {
			new MutationObserver(schedule).observe(document.body, {
				childList: true,
				subtree: true
			});
		} catch (e) {
			console.error("pcl_desk sidebar_icons observer:", e);
		}
	}

	if (document.body) {
		start();
	} else {
		document.addEventListener("DOMContentLoaded", start);
	}

	// The sidebar is built after this file runs. The observer catches that, but
	// a few early passes cost nothing and close the gap if the observer is
	// attached a moment late.
	var tries = 0;
	var timer = setInterval(function () {
		tries++;
		safePaint();
		if (tries > 20) clearInterval(timer);
	}, 200);
})();
