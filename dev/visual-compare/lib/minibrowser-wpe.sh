#!/bin/sh
# Playwright's bundled MiniBrowser wrapper replaces LD_LIBRARY_PATH outright,
# which hides the libraries unpacked by setup-browser-libs.sh. This one prepends
# the bundle's own libraries to the caller's path instead.
D="$VC_MINIBROWSER_DIR"
export WEBKIT_EXEC_PATH="$D/bin"
export WEBKIT_INJECTED_BUNDLE_PATH="$D/lib"
export WEBKIT_INSPECTOR_RESOURCES_PATH="$D/share"
export LD_LIBRARY_PATH="$D/lib:$D/sys/lib:$LD_LIBRARY_PATH"
WEBKIT_FORCE_COMPLEX_TEXT=1 exec "$D/bin/MiniBrowser" "$@"
