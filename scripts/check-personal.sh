#!/bin/sh
cd "$(dirname "$0")/.." || exit 2
missing=0
check() {
  file=$1
  key=$2
  if [ ! -f "$file" ]; then
    echo "MISSING FILE  $file"
    missing=1
  elif [ -n "$key" ] && ! grep -qF -- "$key" "$file"; then
    echo "MISSING       $file :: $key"
    missing=1
  fi
}
check plugin/hooks/presets.ts one-dark-pro
check plugin/.claude-plugin/plugin.json one-dark-pro
check plugin/hooks/theme.ts promptSide
check plugin/.claude-plugin/plugin.json promptSide
check plugin/hooks/help.ts promptSide
check plugin/hooks/register.tsx SETUP_PAGE
check plugin/hooks/render.tsx agentName
check plugin/hooks/register.tsx avatars/avatar.png
check plugin/hooks/theme.ts userAvatar
check plugin/.claude-plugin/plugin.json userAvatar
check plugin/hooks/register.tsx locateOnce
check plugin/hooks/register.tsx HINT_EVERY
check plugin/hooks/render.tsx mergedRuns
check plugin/hooks/paste.tsx IMAGE_TAG
check plugin/bin/imgview.py ''
check tests/paste.test.tsx ''
check tests/clipboard.test.tsx ''
check plugin/hooks/render.tsx rememberPress
check plugin/hooks/render.tsx markPress
check plugin/hooks/register.tsx rememberPress
check tests/render.test.tsx 'copies a block on a press of its ⧉ marker'
check plugin/hooks/theme.ts 'copyPopup'
check tests/render.test.tsx 'copyPopup false leaves only the pressable'
check plugin/hooks/paste.tsx pictureRow
check plugin/hooks/render.tsx pictureRow
check plugin/hooks/register.tsx keepPictures
check plugin/hooks/theme.ts sentImages
check plugin/.claude-plugin/plugin.json sentImages
check tests/paste.test.tsx 'a sent prompt draws its pasted image as a picture'
if [ -d .github/workflows ]; then
  echo "UNEXPECTED    .github/workflows exists (personal has no CI)"
  missing=1
fi
if [ "$missing" -eq 0 ]; then
  echo "personal features: all present"
fi
exit "$missing"
