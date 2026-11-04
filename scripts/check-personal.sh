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
check hooks/presets.ts one-dark-pro
check .claude-plugin/plugin.json one-dark-pro
check hooks/theme.ts promptSide
check .claude-plugin/plugin.json promptSide
check hooks/help.ts promptSide
check hooks/register.tsx SETUP_PAGE
check hooks/render.tsx agentName
check hooks/register.tsx avatars/avatar.png
check hooks/theme.ts userAvatar
check .claude-plugin/plugin.json userAvatar
check hooks/register.tsx locateOnce
check hooks/register.tsx HINT_EVERY
check hooks/render.tsx mergedRuns
check hooks/paste.tsx IMAGE_TAG
check bin/imgview.py ''
check tests/paste.test.tsx ''
check tests/clipboard.test.tsx ''
check hooks/render.tsx rememberPress
check hooks/render.tsx markPress
check hooks/register.tsx rememberPress
check tests/render.test.tsx 'copies a block on a press of its ⧉ marker'
check hooks/theme.ts 'copyPopup'
check tests/render.test.tsx 'copyPopup false leaves only the pressable'
check hooks/paste.tsx pictureRow
check hooks/render.tsx pictureRow
check hooks/register.tsx keepPictures
check hooks/theme.ts sentImages
check .claude-plugin/plugin.json sentImages
check tests/paste.test.tsx 'a sent prompt draws its pasted image as a picture'
if [ -d .github/workflows ]; then
  echo "UNEXPECTED    .github/workflows exists (personal has no CI)"
  missing=1
fi
if [ "$missing" -eq 0 ]; then
  echo "personal features: all present"
fi
exit "$missing"
