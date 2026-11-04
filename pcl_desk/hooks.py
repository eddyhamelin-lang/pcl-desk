app_name = "pcl_desk"
app_title = "Phannthamit Desk"
app_publisher = "Phannthamit Co., Ltd"
app_description = "Desk navigation and styling for Phannthamit Co., Ltd"
app_email = "noreply@phannthamit.com"
app_license = "MIT"

# ── DESK ASSETS ──────────────────────────────────────────────────────────────
# This is the entire contract with Frappe. No boot hook, no doc_events, no
# scheduler jobs, no overridden methods, no forked templates — this app adds one
# stylesheet and four scripts to the desk and nothing else. Anything that starts
# deciding what a user may see belongs in a DocType with permissions, not here.
#
# The `?v=` suffixes are cache busters. Bump the number whenever the file
# changes, or browsers will keep serving the old copy for hours.
app_include_css = [
    "/assets/pcl_desk/css/pcl_desk.css?v=4",
]

app_include_js = [
    # sidebar_lock is first on purpose: it patches frappe.ui.Sidebar as early as
    # possible, so the company menu is the one drawn on first paint.
    #
    # 4 November 2026, bumped v7 -> v8. sidebar_lock.js was rewritten for
    # v16.53 and deployed, the new file was served correctly, and NOTHING
    # CHANGED - because the suffix had not moved, so every browser kept running
    # the cached v7 copy. The comment above says exactly this and it still got
    # missed. If a deploy of this app ever appears to do nothing, check here
    # first.
    #
    # 4 November 2026, later the same day, bumped v8 -> v9. The scoped menus
    # went live, Tevy and Theara both said the sidebar had lost most of what
    # they use and all of its icons, and the default changed from "leave the
    # desk alone" to "draw the company tree". Bumped at the same moment the
    # file was edited this time, rather than after being caught out by it.
    "/assets/pcl_desk/js/sidebar_lock.js?v=9",
    #
    # 4 November 2026, new. sidebar_lock puts the company tree back; this draws
    # the icons on it. Frappe v16 omits the icon element for any item nested
    # under a Section Break heading, so 74 items carried an icon in the data
    # and three were visible on screen. Tevy: "there are no more coloured
    # icons." Loaded after the lock because it reads the menu the lock chose.
    "/assets/pcl_desk/js/sidebar_icons.js?v=1",
    "/assets/pcl_desk/js/all_options.js?v=1",
    "/assets/pcl_desk/js/chart_tidy.js?v=1",
]

# ── APPS SCREEN ──────────────────────────────────────────────────────────────
# Frappe v16 puts an apps screen in front of the desk, and it is built ONLY from
# this hook — frappe.apps.get_apps() reads add_to_apps_screen and nothing else,
# so no site setting, no fixture and no DocType can add a tile. Without an entry
# here the company had no tile of its own: staff opening the system were met by
# a grid of generic ERPNext modules with the word Phannthamit nowhere on it, and
# had to already know to click through to the command centre.
#
# "name" MUST equal app_name. frappe.apps.get_route() matches on it, and a
# mismatch quietly sends System Settings > Default App to /apps instead.
#
# Setting System Settings > Default App to "pcl_desk" then makes this route the
# landing page for everybody, so the apps screen becomes the fallback rather
# than the front door.
#
# The logo is the site file already serving as the navbar logo and the favicon,
# so the company has one logo rather than three copies drifting apart.
add_to_apps_screen = [
    {
        "name": "pcl_desk",
        "logo": "/files/phannthamit_logo.png",
        "title": "Phannthamit",
        "route": "/desk/phannthamit",
    }
]
