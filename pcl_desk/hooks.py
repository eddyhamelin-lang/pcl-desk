app_name = "pcl_desk"
app_title = "Phannthamit Desk"
app_publisher = "Phannthamit Co., Ltd"
app_description = "Desk navigation and styling for Phannthamit Co., Ltd"
app_email = "noreply@phannthamit.com"
app_license = "MIT"

# ── DESK ASSETS ───────────────────────────────────────────────────────────────
# This is the entire contract with Frappe. No boot hook, no doc_events, no
# scheduler jobs, no overridden methods, no forked templates — this app adds one
# stylesheet and two scripts to the desk and nothing else. Anything that starts
# deciding what a user may see belongs in a DocType with permissions, not here.
#
# The `?v=` suffixes are cache busters. Bump the number whenever the file
# changes, or browsers will keep serving the old copy for hours.
app_include_css = [
    "/assets/pcl_desk/css/pcl_desk.css?v=2",
]

app_include_js = [
    # sidebar_lock is first on purpose: it rewrites frappe.boot before anything
    # renders, so the company menu is already the one in hand on first paint.
    "/assets/pcl_desk/js/sidebar_lock.js?v=1",
    "/assets/pcl_desk/js/all_options.js?v=1",
]
