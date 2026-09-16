# Phannthamit Desk (`pcl_desk`)

A small Frappe app that adds navigation and styling to the ERPNext desk for
**Phannthamit Co., Ltd**. It ships **one stylesheet and two scripts**, and
nothing else.

## Why it exists

Two reasons, and the second is the one that matters.

**1. There is no site-wide desk CSS or JS without a custom app.** A Client Script
is bound to a single DocType, so the *Back* button that Vibol asked for needed 30
near-identical copies. A Custom HTML Block only renders inside a workspace. This
app is the supported hook, and it is the reason the 30 Client Scripts can go.

**2. Frappe v16 draws a different sidebar on almost every page** — and this is
the one that has been reopened over and over since August.

`frappe.boot.workspace_sidebar_item` maps a lowercased workspace name to the
sidebar to draw. On this site it holds **73 entries**, because Frappe derives one
automatically from every workspace's own contents:

```
workspace_sidebar_item["sales map"]    ->   7 items   (Home, All leads, ...)
workspace_sidebar_item["finance"]      ->   9 items
workspace_sidebar_item["store room"]   ->   4 items
workspace_sidebar_item["phannthamit"]  ->  51 items   <- the one we built
```

So the Sales Map, Finance, Store Room and every list and form showed a thin
auto-generated stub instead of the company menu. **Our sidebar record was never
wrong** — it was correct every single time it was checked. The renderer was being
handed a different one.

`sidebar_lock.js` points all 73 keys at the Phannthamit sidebar, before the desk
renders. There is then nothing else for the renderer to pick.

## What it does

| | |
|---|---|
| **One sidebar, everywhere** | The company menu on every page — workspaces, lists, forms, reports, even the LMS workspace. See above. |
| **Back button** | On **every page**, not just forms. It used to be 30 Client Scripts, which only existed on forms — so there was no Back on a workspace, a list or a report, which is exactly where people got stuck. Goes where you actually came from; the breadcrumb goes to the list, which is usually not the same place. Hidden when there is no history. |
| **All options drawer** | A right-hand panel with the whole menu, searchable, plus Theme, Text size and Spacing. |
| **Navbar buttons** | Back, Search (the same modal as Ctrl+K), Company Home, My tasks, All options — added to the row that is already at the top of every page. |
| **Two-tone canvas** | A tinted page with white cards floating on it, so every card has an edge without a border being drawn. |
| **Sidebar polish** | A hover tint that tells you which of 51 rows you are about to hit, and section headings that read as headings. |
| **Wide workspaces** | Lifts Frappe's 900px cap on named workspaces. Currently the Sales Map, because a map is the kind of thing that earns the room. |

## What it deliberately does not do

- **No forked `www/desk.html`.** The theme this replaces forked Frappe's desk
  template so it could inline colours held in a database record. A static
  stylesheet shipped through `app_include_css` is already in `<head>` before
  first paint — no flash, and nothing to re-diff after every Frappe upgrade.
  That fork was the single biggest risk in the app we removed.
- **No settings doctype, no theme editor.** One brand, set once, in a file.
- **No `boot_session`, no `doc_events`, no `override_whitelisted_methods`, no
  scheduler jobs.** The whole contract with Frappe is in `hooks.py` and it is
  eight lines.
- **Nothing that decides which fields a person may see.** That belongs in a
  DocType with permissions. A theme that hides form fields is how the previous
  app emptied the Lead and Customer forms on its first day.
- **No dark-mode stylesheet.** v16 has dark mode natively, per user.

## Layout

```
pcl_desk/
  hooks.py                     the entire contract: 1 stylesheet, 2 scripts
  modules.txt                  "PCL Desk"
  patches.txt                  intentionally empty — this app migrates nothing
  public/css/pcl_desk.css      canvas, sidebar, drawer, navbar buttons
  public/js/sidebar_lock.js    one sidebar on every page — the main event
  public/js/all_options.js     drawer, navbar buttons (incl. Back), wide routes
```

## Installing

Frappe Cloud → bench → **Apps → Add App → Add from GitHub → Public Repository**,
paste this repo's URL, fetch branches, add. Then deploy, then install on the site
from **Sites → site → Apps → Install App**.

## After it is live

1. **Open the Sales Map, then Finance, then a Quotation.** The Phannthamit menu
   should be on the left every time. This is the thing to check first, because
   it is the thing that kept coming back.
2. Check a Lead: six tabs, every field visible, `← Back` present **exactly once**
   (two means the old Client Scripts are still there — see step 5).
3. Check the SOP Register breadcrumb still reads *Phannthamit / SOP Register / …*.
4. Check `/my` on a phone is untouched. This app adds nothing to website pages.
5. Only then delete the old Client Scripts: filter `Client Script` on
   `name like "PCL Back Button%"` — there are 30.

If anything looks wrong, uninstalling is clean: `patches.txt` is empty and the
app owns no data.

## Editing it

Asset URLs in `hooks.py` carry `?v=` cache busters. **Bump the number whenever
you change a file**, or browsers will keep serving the old copy for hours.

## Credit

Some of the sidebar selector chains were learned from
[Solvronix Desk](https://github.com/Solvronix/Solvronix-Desk) (MIT). Frappe's own
sidebar rules carry three classes, so anything shorter loses the cascade; the
four-class chains are the reason these rules take effect at all. The ideas behind
the drawer and the two-tone canvas came from there too. The code here is our own,
and the parts of that app that caused problems — progressive forms, the smart
home page, the theme editor, the forked template — are deliberately absent.

Background and the full list of what was kept and why:
`claude/desk-harvest-list.md` in the project.
