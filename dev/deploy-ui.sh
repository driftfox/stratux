#!/usr/bin/env bash
# Copy the committed web UI onto a running Stratux over SSH, without building
# a new image. See dev/README.md for the one-time SSH key setup.
#
#   dev/deploy-ui.sh [--restore] [--no-reboot] [user@host]
#
# Host defaults to $STRATUX_HOST, then pi@192.168.10.1 (the Stratux access point).
set -euo pipefail

usage() {
	sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
	exit "${1:-0}"
}

restore=no
reboot=yes
host="${STRATUX_HOST:-pi@192.168.10.1}"
for arg in "$@"; do
	case "$arg" in
		--restore) restore=yes ;;
		--no-reboot) reboot=no ;;
		-h|--help) usage ;;
		-*) echo "Unknown option: $arg" >&2; usage 1 ;;
		*) host="$arg" ;;
	esac
done
addr="${host#*@}"
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10)

say() { printf '\n==> %s\n' "$*"; }

say "Checking SSH and sudo on $host"
if ! ssh "${ssh_opts[@]}" "$host" 'sudo -n true'; then
	echo "Cannot log in to $host with a key, or sudo needs a password. Nothing was changed." >&2
	exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

expected=""
if [ "$restore" = no ]; then
	repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
	cd "$repo"
	if [ -n "$(git status --porcelain -- web)" ]; then
		echo "Note: web/ has uncommitted changes; they are NOT deployed (only the last commit is)." >&2
	fi
	hash="$(git rev-parse HEAD)"

	say "Packing web UI from commit ${hash:0:7}"
	# The same file list web/Makefile installs.
	mkdir "$tmp/www"
	git archive --format=tar "HEAD:web" css js img maui plates index.html alert.wav stratux.appcache \
		| tar -xf - -C "$tmp/www"
	# Matches web/Makefile; a changed manifest is what makes browsers drop the cached UI.
	echo "# build time:  $(date +%s)" >>"$tmp/www/stratux.appcache"
	echo "# Stratux build:  $hash" >>"$tmp/www/stratux.appcache"
	expected="$(tail -1 "$tmp/www/stratux.appcache")"
	tar -cf "$tmp/www.tar" -C "$tmp/www" .

	say "Uploading"
	ssh "${ssh_opts[@]}" "$host" 'cat > /tmp/stratux-ui.tar' <"$tmp/www.tar"
	label=new
else
	label=original
	expected="$(ssh "${ssh_opts[@]}" "$host" \
		'd=/opt/stratux; [ -e /overlay/robase/overlay ] && d=/overlay/robase/opt/stratux; tail -1 "$d/www.original/stratux.appcache" 2>/dev/null' || true)"
	if [ -z "$expected" ]; then
		echo "No www.original backup on $host; nothing to restore. Nothing was changed." >&2
		exit 1
	fi
fi

say "Installing on the Pi"
# shellcheck disable=SC2087 # $restore is meant to expand locally.
ssh "${ssh_opts[@]}" "$host" "sudo bash -s" <<EOF
set -euo pipefail
restore=$restore

# With the overlay active, the real SD card copy is mounted read-only at
# /overlay/robase; writing to /opt/stratux would only change the RAM layer.
if [ -e /overlay/robase/overlay ]; then
	mnt=/overlay/robase
else
	mnt=/
fi
dir="\${mnt%/}/opt/stratux"

relock=no
if findmnt -no OPTIONS "\$mnt" | grep -qw ro; then
	/sbin/overlayctl unlock
	relock=yes
fi
cleanup() {
	rc=\$?
	rm -f /tmp/stratux-ui.tar
	sync
	if [ "\$relock" = yes ] && ! /sbin/overlayctl lock 2>/dev/null; then
		echo "The SD card could not be re-locked while files are in use; it is read-only again after the reboot."
	fi
	exit \$rc
}
trap cleanup EXIT

cd "\$dir"
rm -rf www.new www.old
if [ "\$restore" = yes ]; then
	if [ ! -d www.original ]; then
		echo "No www.original backup on the Pi; nothing to restore." >&2
		exit 1
	fi
	cp -a www.original www.new
else
	if [ ! -d www.original ]; then
		cp -a www www.original
		echo "Saved the current UI as \$dir/www.original"
	fi
	mkdir www.new
	tar -xf /tmp/stratux-ui.tar -C www.new
	chown -R --reference=www www.new
	chmod 755 www.new
fi

rm -rf www.previous
cp -a www www.previous
# www.old is removed on the next run: deleting files the running overlay still
# holds open makes the card impossible to re-lock until a reboot.
mv www www.old
mv www.new www
echo "Previous UI kept as \$dir/www.previous"
EOF

if [ "$reboot" = no ]; then
	say "Done without rebooting. Reboot the Pi before relying on the new UI."
	exit 0
fi

say "Rebooting the Pi"
ssh "${ssh_opts[@]}" "$host" 'sudo systemctl reboot' || true
sleep 15

say "Waiting for the Pi to serve the new UI"
for _ in $(seq 1 36); do
	if curl -fsS --max-time 5 "http://$addr/stratux.appcache" 2>/dev/null | grep -qxF "$expected"; then
		say "Done: http://$addr/ is serving the $label UI."
		echo "Reload the page once on each phone or tablet to pick it up."
		exit 0
	fi
	sleep 5
done
echo "Could not confirm the new UI at http://$addr/ within 3 minutes (looking for: $expected)." >&2
echo "The install itself finished. If the Pi rejoined a different network (for example its own" >&2
echo "Stratux WiFi when passthrough does not reconnect), check the UI there." >&2
exit 1
