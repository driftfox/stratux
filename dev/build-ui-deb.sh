#!/usr/bin/env bash
# Build a .deb that replaces only the web UI of an installed Stratux. Install it
# from Settings > System Update (Stratux built from master or later), or with
# dpkg -i on the Pi. Removing the package puts the previous UI back.
#
#   dev/build-ui-deb.sh [output-dir]
#
# Packs the last commit, not the working tree. Output defaults to the repo root.
set -euo pipefail

repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$repo"
out="$(cd "${1:-.}" && pwd)"

if [ -n "$(git status --porcelain -- web)" ]; then
	echo "Note: web/ has uncommitted changes; they are NOT packaged (only the last commit is)." >&2
fi

hash="$(git rev-parse HEAD)"
tag="$(git describe --tags --abbrev=0)"
count="$(git rev-list --count "$tag..HEAD")"
# Fork release tags already carry a +uiN suffix (v2.0-pre5+ui2); don't stack another.
case "$tag" in
*+ui*) version="${tag#v}.$count.g${hash:0:7}" ;;
*) version="${tag#v}+ui$count.g${hash:0:7}" ;;
esac
maintainer="$(git config user.name) <$(git config user.email)>"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
root="$tmp/pkg"
www="$root/opt/stratux-ui/www"
mkdir -p "$www" "$root/DEBIAN"

# The same file list web/Makefile installs.
git archive --format=tar "HEAD:web" css js img maui plates index.html alert.wav stratux.appcache \
	| tar -xf - -C "$www"
# A changed manifest is what makes browsers drop the cached UI. The last line
# also tells postinst that the installed UI came from this package.
{
	echo "# build time:  $(date +%s)"
	echo "# Stratux build:  $hash"
	echo "# Stratux UI package:  $version"
} >>"$www/stratux.appcache"
chmod -R u=rwX,go=rX "$root"

cat >"$root/DEBIAN/control" <<EOF
Package: stratux-ui
Version: $version
Architecture: all
Maintainer: $maintainer
Depends: stratux
Section: misc
Priority: optional
Description: Stratux web interface (UI-only update)
 Replaces the web interface in /opt/stratux/www. The UI it replaces is kept in
 /opt/stratux/www.stock and restored when this package is removed. Installing a
 newer stratux package brings back that package's own UI.
EOF

cat >"$root/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
[ "$1" = configure ] || exit 0
dir=/opt/stratux
if [ -d "$dir/www" ] && ! grep -q '^# Stratux UI package:' "$dir/www/stratux.appcache" 2>/dev/null; then
	rm -rf "$dir/www.stock"
	cp -a "$dir/www" "$dir/www.stock"
	echo "Saved the current UI as $dir/www.stock"
fi
rm -rf "$dir/www.new" "$dir/www.old"
cp -a /opt/stratux-ui/www "$dir/www.new"
if [ -d "$dir/www" ]; then
	mv "$dir/www" "$dir/www.old"
fi
mv "$dir/www.new" "$dir/www"
rm -rf "$dir/www.old"
EOF

cat >"$root/DEBIAN/postrm" <<'EOF'
#!/bin/sh
set -e
dir=/opt/stratux
case "$1" in
remove|purge)
	# Only undo our own install; a newer stratux package may have replaced it already.
	if [ -d "$dir/www.stock" ] && grep -q '^# Stratux UI package:' "$dir/www/stratux.appcache" 2>/dev/null; then
		rm -rf "$dir/www"
		mv "$dir/www.stock" "$dir/www"
		echo "Restored the previous UI from $dir/www.stock"
	fi
	;;
esac
EOF
chmod 755 "$root/DEBIAN/postinst" "$root/DEBIAN/postrm"

# The Stratux updater only picks up files named stratux*.deb.
deb="$out/stratux-ui-$version-all.deb"
dpkg-deb --root-owner-group -Zxz -b "$root" "$deb" >/dev/null
echo "$deb"
